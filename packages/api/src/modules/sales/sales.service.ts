import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SalesService {
    constructor(private readonly prisma: PrismaService) { }

    private async autoForwardOrderToOpsIfNeeded(orderId: string, actorId?: string | null) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                payments: true,
                quotation: { select: { cartId: true } },
            },
        });
        if (!order) throw new NotFoundException('Order not found');

        const paymentConfirmedAt = this.inferPaymentConfirmedAt(order);
        if (!paymentConfirmedAt) {
            return { order, autoForwarded: false, alreadyForwarded: false };
        }

        const alreadyForwarded = Boolean(order.forwardedToOpsAt)
            || ['confirmed', 'in_procurement', 'shipped', 'partially_shipped', 'delivered', 'partially_delivered'].includes(order.status);
        if (alreadyForwarded) {
            return { order, autoForwarded: false, alreadyForwarded: true };
        }

        const now = new Date();
        const updated = await this.prisma.order.update({
            where: { id: order.id },
            data: {
                status: 'confirmed',
                forwardedToOpsAt: now,
                forwardedToOpsById: actorId || order.salesPersonId || null,
            },
            include: {
                quotation: { select: { cartId: true } },
            },
        });

        const opsUsers = await this.prisma.user.findMany({
            where: { userType: 'operations', isActive: true },
            select: { id: true },
        });

        if (opsUsers.length > 0) {
            await this.prisma.notification.createMany({
                data: opsUsers.map((u) => ({
                    userId: u.id,
                    type: 'ops_fulfillment_ready',
                    title: 'Order Ready for Processing',
                    message: `Paid order #${updated.orderNumber} is ready for fulfillment.`,
                    link: `/ops/orders`,
                })),
            });
        }

        if (updated.quotation?.cartId) {
            await this.prisma.message.create({
                data: {
                    cartId: updated.quotation.cartId,
                    senderId: actorId || order.salesPersonId || order.buyerId,
                    content: '[System] FORWARDED_TO_OPS_FOR_FULFILLMENT',
                },
            }).catch(() => null);
        }

        return { order: updated, autoForwarded: true, alreadyForwarded: false };
    }

    private async getOwnedOrder(orderId: string, salesPersonId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                quotation: { select: { id: true, cartId: true } },
                payments: true,
            },
        });

        if (!order) throw new NotFoundException('Order not found');
        if (order.salesPersonId && order.salesPersonId !== salesPersonId) {
            throw new BadRequestException('This order is not assigned to you');
        }
        return order;
    }

    private async getOwnedOrderByQuotation(quotationId: string, salesPersonId: string) {
        const order = await this.prisma.order.findFirst({
            where: { quotationId },
            include: {
                quotation: { select: { id: true, cartId: true } },
                payments: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!order) throw new NotFoundException('Order not found for this quotation');
        if (order.salesPersonId && order.salesPersonId !== salesPersonId) {
            throw new BadRequestException('This order is not assigned to you');
        }
        return order;
    }

    private inferPaymentConfirmedAt(order: {
        paymentConfirmedAt: Date | null;
        payments: Array<{ status: string; paidAt: Date | null; createdAt: Date }>;
        paidAmount: number | { toString(): string } | null;
        totalAmount: number | { toString(): string } | null;
    }) {
        if (order.paymentConfirmedAt) return order.paymentConfirmedAt;
        const total = Number(order.totalAmount || 0);
        const paid = Number(order.paidAmount || 0);
        if (total > 0 && paid < total) return null;
        const paidRecord = order.payments.find((p) => ['paid'].includes((p.status || '').toLowerCase()));
        return paidRecord?.paidAt || paidRecord?.createdAt || null;
    }

    private inferOpsFinalCheckStatus(order: {
        opsFinalCheckStatus?: string | null;
        paymentLinkSentAt?: Date | null;
        paymentConfirmedAt?: Date | null;
        forwardedToOpsAt?: Date | null;
    }) {
        const explicit = (order.opsFinalCheckStatus || '').toLowerCase();
        if (explicit === 'approved' || explicit === 'pending' || explicit === 'rejected') return explicit;
        if (order.paymentLinkSentAt || order.paymentConfirmedAt || order.forwardedToOpsAt) return 'approved';
        return 'pending';
    }

    private withInferredWorkflowMetadata<T extends {
        status: string;
        paidAmount: number | { toString(): string } | null;
        totalAmount: number | { toString(): string } | null;
        paymentLinkSentAt: Date | null;
        paymentConfirmedAt: Date | null;
        opsFinalCheckStatus?: string | null;
        opsFinalCheckedAt?: Date | null;
        opsFinalCheckedById?: string | null;
        opsFinalCheckReason?: string | null;
        forwardedToOpsAt: Date | null;
        payments: Array<{ status: string; paidAt: Date | null; createdAt: Date }>;
    }>(order: T | null) {
        if (!order) return null;
        const inferredConfirmed = this.inferPaymentConfirmedAt(order);
        const inferredForwarded = order.forwardedToOpsAt
            || (['confirmed', 'in_procurement', 'shipped', 'partially_shipped', 'delivered', 'partially_delivered'].includes(order.status)
                ? new Date()
                : null);
        return {
            ...order,
            opsFinalCheckStatus: this.inferOpsFinalCheckStatus(order),
            paymentConfirmedAt: order.paymentConfirmedAt || inferredConfirmed,
            forwardedToOpsAt: inferredForwarded,
        };
    }

    async createOrderPaymentLink(orderId: string, salesPersonId: string) {
        const order = await this.getOwnedOrder(orderId, salesPersonId);
        if (this.inferOpsFinalCheckStatus(order) !== 'approved') {
            throw new BadRequestException('Ops final check must be approved before sending payment link');
        }
        if ((order.opsFinalCheckStatus || '').toLowerCase() === 'rejected') {
            throw new BadRequestException('Cannot send payment link for a rejected request');
        }
        const now = new Date();
        const updated = await this.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentLinkSentAt: now,
                paymentLinkSentById: salesPersonId,
                paymentLinkChannel: 'sales_portal',
            },
        });

        await this.prisma.notification.create({
            data: {
                userId: updated.buyerId,
                type: 'payment_link_sent',
                title: 'Payment Link Sent',
                message: `Payment link has been shared for order #${updated.orderNumber}.`,
                link: '/app/orders',
            },
        });

        return {
            success: true,
            orderId: updated.id,
            paymentLinkSentAt: updated.paymentLinkSentAt,
        };
    }

    async resendOrderPaymentLink(orderId: string, salesPersonId: string) {
        return this.createOrderPaymentLink(orderId, salesPersonId);
    }

    async createQuotationPaymentLink(quotationId: string, salesPersonId: string) {
        const order = await this.getOwnedOrderByQuotation(quotationId, salesPersonId);
        return this.createOrderPaymentLink(order.id, salesPersonId);
    }

    async resendQuotationPaymentLink(quotationId: string, salesPersonId: string) {
        const order = await this.getOwnedOrderByQuotation(quotationId, salesPersonId);
        return this.resendOrderPaymentLink(order.id, salesPersonId);
    }

    async getOrderPaymentStatus(orderId: string, salesPersonId: string) {
        const order = await this.getOwnedOrder(orderId, salesPersonId);
        const paymentConfirmedAt = this.inferPaymentConfirmedAt(order);
        const isPaymentConfirmed = Boolean(paymentConfirmedAt);
        const isLinkSent = Boolean(order.paymentLinkSentAt);
        const isForwardedToOps = Boolean(order.forwardedToOpsAt) || ['confirmed', 'in_procurement', 'shipped', 'partially_shipped', 'delivered', 'partially_delivered'].includes(order.status);
        const opsFinalCheckStatus = this.inferOpsFinalCheckStatus(order);

        return {
            orderId: order.id,
            orderStatus: order.status,
            opsFinalCheckStatus,
            opsFinalCheckedAt: order.opsFinalCheckedAt,
            opsFinalCheckedById: order.opsFinalCheckedById,
            opsFinalCheckReason: order.opsFinalCheckReason,
            paymentLinkSentAt: order.paymentLinkSentAt,
            paymentLinkSentById: order.paymentLinkSentById,
            paymentLinkChannel: order.paymentLinkChannel,
            paymentConfirmedAt,
            paymentConfirmedById: order.paymentConfirmedById,
            paymentConfirmationSource: order.paymentConfirmationSource,
            forwardedToOpsAt: order.forwardedToOpsAt,
            forwardedToOpsById: order.forwardedToOpsById,
            isLinkSent,
            isPaymentConfirmed,
            isForwardedToOps,
        };
    }

    async getQuotationPaymentStatus(quotationId: string, salesPersonId: string) {
        const order = await this.getOwnedOrderByQuotation(quotationId, salesPersonId);
        return this.getOrderPaymentStatus(order.id, salesPersonId);
    }

    async confirmOrderPayment(
        orderId: string,
        salesPersonId: string,
        payload?: { source?: string; reference?: string },
    ) {
        const order = await this.getOwnedOrder(orderId, salesPersonId);
        if (this.inferOpsFinalCheckStatus(order) !== 'approved') {
            throw new BadRequestException('Ops final check must be approved before confirming payment');
        }
        const paymentConfirmedAt = this.inferPaymentConfirmedAt(order);
        if (paymentConfirmedAt) {
            const forwarded = await this.autoForwardOrderToOpsIfNeeded(order.id, salesPersonId);
            return {
                success: true,
                orderId: order.id,
                paymentConfirmedAt,
                alreadyConfirmed: true,
                autoForwardedToOps: forwarded.autoForwarded,
                forwardedToOpsAt: forwarded.order.forwardedToOpsAt || null,
            };
        }

        const now = new Date();
        const updated = await this.prisma.order.update({
            where: { id: order.id },
            data: {
                paymentConfirmedAt: now,
                paymentConfirmedById: salesPersonId,
                paymentConfirmationSource: payload?.source || 'manual_reconciliation',
            },
        });
        const forwarded = await this.autoForwardOrderToOpsIfNeeded(updated.id, salesPersonId);

        return {
            success: true,
            orderId: updated.id,
            paymentConfirmedAt: updated.paymentConfirmedAt,
            paymentConfirmationSource: updated.paymentConfirmationSource,
            autoForwardedToOps: forwarded.autoForwarded,
            forwardedToOpsAt: forwarded.order.forwardedToOpsAt || null,
        };
    }

    async confirmQuotationPayment(
        quotationId: string,
        salesPersonId: string,
        payload?: { source?: string; reference?: string },
    ) {
        const order = await this.getOwnedOrderByQuotation(quotationId, salesPersonId);
        return this.confirmOrderPayment(order.id, salesPersonId, payload);
    }

    async forwardPaidOrderToOps(orderId: string, salesPersonId: string) {
        const owned = await this.getOwnedOrder(orderId, salesPersonId);
        if (this.inferOpsFinalCheckStatus(owned) !== 'approved') {
            throw new BadRequestException('Ops final check must be approved before forwarding to Ops');
        }
        const paymentConfirmedAt = this.inferPaymentConfirmedAt(owned);
        if (!paymentConfirmedAt) throw new BadRequestException('Payment must be confirmed before forwarding to Ops');
        const forwarded = await this.autoForwardOrderToOpsIfNeeded(orderId, salesPersonId);
        return {
            success: true,
            orderId,
            status: forwarded.order.status,
            forwardedToOpsAt: forwarded.order.forwardedToOpsAt || null,
            alreadyForwarded: forwarded.alreadyForwarded,
        };
    }

    // ─── Dashboard Metrics ───

    async getDashboardMetrics(salesPersonId: string) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const [
            assignedRequests,
            draftQuotes,
            sentQuotes,
            activeNegotiations,
            totalCommissionAgg,
            mtdCommissionAgg,
            pipelineData,
            orderCount,
            recentAssignedCarts,
            recentCommissions,
        ] = await Promise.all([
            this.prisma.intendedCart.count({
                where: { assignedSalesId: salesPersonId, status: { in: ['submitted', 'under_review'] } },
            }),
            this.prisma.quotation.count({
                where: { createdById: salesPersonId, status: 'draft' },
            }),
            this.prisma.quotation.count({
                where: { createdById: salesPersonId, status: { in: ['sent', 'countered', 'negotiating', 'rejected'] } },
            }),
            this.prisma.intendedCart.count({
                where: { assignedSalesId: salesPersonId, status: 'quoted' },
            }),
            this.prisma.commissionRecord.aggregate({
                where: { salesPersonId, status: { in: ['paid', 'pending'] } },
                _sum: { amount: true },
            }),
            this.prisma.commissionRecord.aggregate({
                where: { salesPersonId, status: { in: ['paid', 'pending'] }, createdAt: { gte: startOfMonth } },
                _sum: { amount: true },
            }),
            this.prisma.intendedCart.groupBy({
                by: ['status'],
                where: { assignedSalesId: salesPersonId },
                _count: true,
            }),
            this.prisma.order.count({
                where: { salesPersonId },
            }),
            // Fetch 5 most recent requests for a quick action table
            this.prisma.intendedCart.findMany({
                where: { assignedSalesId: salesPersonId, status: { in: ['submitted', 'under_review', 'quoted'] } },
                orderBy: { updatedAt: 'desc' },
                take: 5,
                include: {
                    user: { select: { email: true, firstName: true, lastName: true } },
                    quotations: {
                        orderBy: { createdAt: 'desc' },
                        take: 1,
                        select: { status: true }
                    }
                }
            }),
            this.prisma.commissionRecord.findMany({
                where: { salesPersonId },
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: { order: { select: { orderNumber: true } } }
            }),
        ]);

        // Transform pipeline data for UI strictly from DB
        const pipeline = {
            leads: 0,
            validated: 0,
            quoted: 0,
            ordered: orderCount,
        };

        pipelineData.forEach(item => {
            if (item.status === 'submitted') pipeline.leads += item._count;
            if (item.status === 'under_review') pipeline.validated += item._count;
            if (item.status === 'quoted') pipeline.quoted += item._count;
        });

        const totalEarned = Number(totalCommissionAgg._sum.amount || 0);
        const mtdEarned = Number(mtdCommissionAgg._sum.amount || 0);

        // Precise conversions based on lifetime assignments (simplistic but exact mathematically for this view)
        const totalLeads = pipeline.leads + pipeline.validated + pipeline.quoted + pipeline.ordered;
        const totalQuotesHit = pipeline.quoted + pipeline.ordered;

        return {
            assignedRequests,
            draftQuotes,
            sentQuotes,
            activeNegotiations,
            earnings: {
                total: totalEarned,
                mtd: mtdEarned,
            },
            pipeline,
            conversions: {
                leadsToQuotes: totalLeads > 0 ? Math.round((totalQuotesHit / totalLeads) * 100) : 0,
                quotesToOrders: totalQuotesHit > 0 ? Math.round((pipeline.ordered / totalQuotesHit) * 100) : 0,
            },
            recentActivity: {
                requests: recentAssignedCarts.map(cart => {
                    const latestQuote = cart.quotations?.[0];
                    const displayStatus = latestQuote?.status === 'countered'
                        ? 'countered'
                        : latestQuote?.status === 'negotiating' || latestQuote?.status === 'sent'
                            ? 'quoted'
                            : cart.status;
                    return {
                        id: cart.id,
                        buyer: [cart.user.firstName, cart.user.lastName].filter(Boolean).join(' ') || cart.user.email,
                        status: displayStatus,
                        updatedAt: cart.updatedAt,
                    };
                }),
                commissions: recentCommissions.map(comm => ({
                    id: comm.id,
                    orderNumber: comm.order?.orderNumber || 'Unknown',
                    amount: Number(comm.amount),
                    status: comm.status,
                    date: comm.createdAt,
                })),
            }
        };
    }


    // ─── Quote Request Details ───

    async getQuoteRequestDetails(cartId: string) {
        const cart = await this.prisma.intendedCart.findUnique({
            where: { id: cartId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        companyName: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                    },
                },
                session: {
                    select: {
                        id: true,
                        thumbnailUrl: true,
                        geminiAttributes: true,
                        selectedCategory: true,
                        maxUnitPrice: true,
                    },
                },
                items: {
                    include: {
                        recommendationItem: {
                            include: {
                                inventorySku: true,
                                manufacturerItem: true,
                            },
                        },
                    },
                },
                quotations: {
                    include: {
                        items: true,
                        createdBy: { select: { firstName: true, lastName: true, email: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                messages: {
                    include: {
                        sender: { select: { id: true, firstName: true, lastName: true, userType: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!cart) throw new NotFoundException('Request not found');
        const latestOrder = await this.prisma.order.findFirst({
            where: { quotation: { cartId } },
            include: { payments: true },
            orderBy: { createdAt: 'desc' },
        });

        return {
            ...cart,
            order: this.withInferredWorkflowMetadata(latestOrder),
        };
    }

    // ─── Quote Preparation (Check Stock & Apply Markup) ───

    async checkStockAvailability(skuIds: string[]) {
        const skus = await this.prisma.inventorySku.findMany({
            where: { id: { in: skuIds }, isActive: true },
            select: {
                id: true,
                skuCode: true,
                name: true,
                availableQuantity: true,
                baseCost: true,
            },
        });
        return skus;
    }

    async getApplicableMarkup(category: string, sourceType: string) {
        // Try category + source specific first, then category, then source, then global
        const configs = await this.prisma.marginConfiguration.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });

        const match = configs.find(
            (c) => c.category === category && c.sourceType === sourceType,
        ) || configs.find(
            (c) => c.category === category && !c.sourceType,
        ) || configs.find(
            (c) => !c.category && c.sourceType === sourceType,
        ) || configs.find(
            (c) => !c.category && !c.sourceType,
        );

        return match || { marginPercentage: 35 };
    }

    // ─── Create Formal Quote ───

    async createQuotation(
        cartId: string,
        items: Array<{ cartItemId: string; finalUnitPrice: number; notes?: string }>,
        terms: string,
        deliveryTimeline: string,
        paymentTerms: string,
        createdById: string,
    ) {
        const cartItems = await this.prisma.cartItem.findMany({ where: { cartId } });

        const quotationItems = items.map((item) => {
            const cartItem = cartItems.find((ci) => ci.id === item.cartItemId);
            const quantity = cartItem?.quantity || 1;
            return {
                cartItemId: item.cartItemId,
                finalUnitPrice: item.finalUnitPrice,
                quantity,
                lineTotal: item.finalUnitPrice * quantity,
                notes: item.notes,
            };
        });

        const quotedTotal = quotationItems.reduce((sum, item) => sum + item.lineTotal, 0);
        const validUntil = new Date();
        validUntil.setHours(validUntil.getHours() + 48);

        const fullTerms = [terms, `Delivery: ${deliveryTimeline}`, `Payment: ${paymentTerms}`]
            .filter(Boolean)
            .join('\n---\n');

        const quotation = await this.prisma.quotation.create({
            data: {
                cartId,
                createdById,
                quotedTotal,
                validUntil,
                terms: fullTerms,
                status: 'draft',
                items: { create: quotationItems },
            },
            include: { items: true },
        });

        // Update cart status
        await this.prisma.intendedCart.update({
            where: { id: cartId },
            data: { status: 'under_review' },
        });

        return quotation;
    }

    // ─── Send Quote ───

    async sendQuotation(quotationId: string) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: { cart: { include: { user: true } } },
        });

        if (!quotation) throw new NotFoundException('Quotation not found');
        if (quotation.status !== 'draft') {
            throw new BadRequestException('Quotation has already been sent');
        }

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48);

        await this.prisma.quotation.update({
            where: { id: quotationId },
            data: { status: 'sent', sentAt: new Date(), expiresAt },
        });

        await this.prisma.intendedCart.update({
            where: { id: quotation.cartId },
            data: { status: 'quoted' },
        });

        // Notify buyer
        await this.prisma.notification.create({
            data: {
                userId: quotation.cart.userId,
                type: 'quote_received',
                title: 'Quotation Ready',
                message: `Your quotation is ready. It expires in 48 hours.`,
                link: `/app/cart/${quotation.cartId}`,
            },
        });

        return { success: true, expiresAt };
    }

    // ─── Revise Quote ───

    async reviseQuotation(
        quotationId: string,
        items: Array<{ cartItemId: string; finalUnitPrice: number }>,
        terms?: string,
    ) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
        });
        if (!quotation) throw new NotFoundException('Quotation not found');

        await this.prisma.quotationItem.deleteMany({ where: { quotationId } });

        const cartItems = await this.prisma.cartItem.findMany({
            where: { cartId: quotation.cartId },
        });

        const newItems = items.map((item) => {
            const cartItem = cartItems.find((ci) => ci.id === item.cartItemId);
            const quantity = cartItem?.quantity || 1;
            return {
                quotationId,
                cartItemId: item.cartItemId,
                finalUnitPrice: item.finalUnitPrice,
                quantity,
                lineTotal: item.finalUnitPrice * quantity,
            };
        });

        await this.prisma.quotationItem.createMany({ data: newItems });
        const quotedTotal = newItems.reduce((sum, i) => sum + i.lineTotal, 0);

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 48);

        return this.prisma.quotation.update({
            where: { id: quotationId },
            data: {
                quotedTotal,
                status: 'sent',
                sentAt: new Date(),
                expiresAt,
                ...(terms !== undefined ? { terms } : {}),
            },
            include: { items: true },
        });
    }

    // ─── Convert Quote to Order ───

    async convertToOrder(quotationId: string, salesPersonId: string) {
        const quotation = await this.prisma.quotation.findUnique({
            where: { id: quotationId },
            include: {
                cart: true,
                items: {
                    include: {
                        cartItem: {
                            include: {
                                recommendationItem: {
                                    include: { inventorySku: true, manufacturerItem: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!quotation) throw new NotFoundException('Quotation not found');
        if (quotation.status !== 'accepted') {
            throw new BadRequestException('Quotation must be accepted to convert to order');
        }

        const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

        const order = await this.prisma.order.create({
            data: {
                quotationId,
                buyerId: quotation.cart.userId,
                salesPersonId,
                orderNumber,
                status: 'pending_payment',
                totalAmount: Number(quotation.quotedTotal || 0),
                items: {
                    create: quotation.items.map((qi) => {
                        const recItem = qi.cartItem.recommendationItem;
                        const source = recItem.inventorySku || recItem.manufacturerItem;
                        return {
                            quotationItemId: qi.id,
                            source: recItem.sourceType === 'inventory' ? 'inventory' : 'manufacturer',
                            productName: source?.name || 'Product',
                            skuCode: (recItem.inventorySku as any)?.skuCode,
                            quantity: qi.quantity,
                            unitPrice: Number(qi.finalUnitPrice),
                            lineTotal: Number(qi.lineTotal),
                        };
                    }),
                },
            },
            include: { items: true },
        });

        // Update cart status
        await this.prisma.intendedCart.update({
            where: { id: quotation.cartId },
            data: { status: 'closed' },
        });

        // Auto-calculate commission (Pending) when order is created
        // This ensures consistency between order counts and commission records on the dashboard
        try {
            await this.calculateCommission(order.id);
        } catch (e: any) {
            console.error('Initial commission calculation failed:', e?.message);
        }

        return order;
    }

    // ─── Messages ───

    async sendMessage(cartId: string, senderId: string, content: string) {
        return this.prisma.message.create({
            data: { cartId, senderId, content },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, userType: true } },
            },
        });
    }

    async getMessages(cartId: string) {
        return this.prisma.message.findMany({
            where: { cartId },
            include: {
                sender: { select: { id: true, firstName: true, lastName: true, userType: true } },
            },
            orderBy: { createdAt: 'asc' },
        });
    }

    // ─── Commission Report ───

    async getCommissionReport(salesPersonId: string) {
        const commissions = await this.prisma.commissionRecord.findMany({
            where: { salesPersonId },
            include: {
                order: { select: { orderNumber: true, totalAmount: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const summary = await this.prisma.commissionRecord.groupBy({
            by: ['status'],
            where: { salesPersonId },
            _sum: { amount: true },
        });

        return { commissions, summary };
    }

    async getCommissionStructure() {
        const rows = await this.prisma.commissionStructure.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        const pick = (name: string, fallback: number) => {
            const row = rows.find((r) => r.name === name);
            const value = row ? Number(row.value) : NaN;
            return Number.isFinite(value) ? value : fallback;
        };
        return {
            baseRate: pick('baseRate', 4),
            highValueRate: pick('highValueRate', 5),
            highValueThreshold: pick('highValueThreshold', 500000),
            paidBonusRate: pick('paidBonusRate', 0.5),
        };
    }

    async saveCommissionStructure(data: {
        baseRate: number;
        highValueRate: number;
        highValueThreshold: number;
        paidBonusRate: number;
    }) {
        const normalized = {
            baseRate: Math.max(0, Number(data.baseRate || 0)),
            highValueRate: Math.max(0, Number(data.highValueRate || 0)),
            highValueThreshold: Math.max(0, Number(data.highValueThreshold || 0)),
            paidBonusRate: Math.max(0, Number(data.paidBonusRate || 0)),
        };

        await this.prisma.$transaction(async (tx) => {
            const entries: Array<{ name: string; type: string; value: number }> = [
                { name: 'baseRate', type: 'percentage', value: normalized.baseRate },
                { name: 'highValueRate', type: 'percentage', value: normalized.highValueRate },
                { name: 'highValueThreshold', type: 'fixed', value: normalized.highValueThreshold },
                { name: 'paidBonusRate', type: 'percentage', value: normalized.paidBonusRate },
            ];
            for (const entry of entries) {
                const latest = await tx.commissionStructure.findFirst({
                    where: { name: entry.name },
                    orderBy: { updatedAt: 'desc' },
                });
                if (latest) {
                    await tx.commissionStructure.update({
                        where: { id: latest.id },
                        data: {
                            type: entry.type,
                            value: entry.value,
                            baseRate: entry.value,
                            thresholdAmount: entry.name === 'highValueThreshold' ? entry.value : null,
                            acceleratedRate: entry.name === 'highValueRate' ? entry.value : null,
                            isActive: true,
                        },
                    });
                    await tx.commissionStructure.updateMany({
                        where: { name: entry.name, id: { not: latest.id } },
                        data: { isActive: false },
                    });
                } else {
                    await tx.commissionStructure.create({
                        data: {
                            name: entry.name,
                            type: entry.type,
                            value: entry.value,
                            baseRate: entry.value,
                            thresholdAmount: entry.name === 'highValueThreshold' ? entry.value : null,
                            acceleratedRate: entry.name === 'highValueRate' ? entry.value : null,
                            isActive: true,
                        },
                    });
                }
            }
        });

        return this.getCommissionStructure();
    }

    // ─── Buyer Onboarding ───

    async getBuyers() {
        return this.prisma.user.findMany({
            where: { userType: 'external' },
            select: {
                id: true,
                email: true,
                companyName: true,
                firstName: true,
                lastName: true,
                phone: true,
                isActive: true,
                createdAt: true,
                _count: { select: { intendedCarts: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getBuyerRequests(salesPersonId: string, buyerId: string) {
        const carts = await this.prisma.intendedCart.findMany({
            where: {
                userId: buyerId,
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        companyName: true,
                        firstName: true,
                        lastName: true,
                        phone: true,
                    },
                },
                items: {
                    select: { id: true },
                },
                quotations: {
                    select: {
                        id: true,
                        status: true,
                        createdAt: true,
                        sentAt: true,
                        quotedTotal: true,
                    },
                    orderBy: { createdAt: 'desc' },
                },
                assignedSales: {
                    select: { id: true },
                },
            },
            orderBy: { submittedAt: 'desc' },
        });

        const cartIds = carts.map((c) => c.id);
        const orders = cartIds.length > 0
            ? await this.prisma.order.findMany({
                where: { quotation: { cartId: { in: cartIds } } },
                include: {
                    payments: true,
                    quotation: { select: { cartId: true } },
                },
                orderBy: { createdAt: 'desc' },
            })
            : [];

        const latestOrderByCart = new Map<string, (typeof orders)[number]>();
        for (const order of orders) {
            const orderCartId = order.quotation?.cartId;
            if (!orderCartId || latestOrderByCart.has(orderCartId)) continue;
            latestOrderByCart.set(orderCartId, order);
        }

        return carts
            .filter((cart) => {
                // Sales can view carts assigned to them, and carts not yet assigned.
                // This preserves visibility for full buyer lifecycle while avoiding cross-owner leakage.
                if (!cart.assignedSales?.id) return true;
                return cart.assignedSales.id === salesPersonId;
            })
            .map((cart) => ({
                ...cart,
                order: this.withInferredWorkflowMetadata(latestOrderByCart.get(cart.id) || null),
            }));
    }

    // ═══════════════════════════════════════════════════════════════
    // QUOTATION WORKFLOW — Phase 8: Balance Payment & Commission
    // ═══════════════════════════════════════════════════════════════

    /**
     * Sales requests balance payment from buyer after shipment.
     */
    async requestBalancePayment(orderId: string, salesPersonId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { buyer: true, shipments: true },
        });

        if (!order) throw new NotFoundException('Order not found');
        if (order.salesPersonId !== salesPersonId) {
            throw new BadRequestException('This order is not assigned to you');
        }

        // Verify order is shipped
        const hasShipped = order.shipments.some(s => s.status === 'shipped' || s.status === 'delivered');
        if (!hasShipped && !['shipped', 'partially_shipped', 'delivered'].includes(order.status)) {
            throw new BadRequestException('Order must be shipped before requesting balance payment');
        }

        const balanceDue = Number(order.totalAmount) - Number(order.paidAmount);
        if (balanceDue <= 0) {
            throw new BadRequestException('No balance payment is due');
        }

        // Update order with balance request timestamp
        const balanceDueAt = new Date();
        balanceDueAt.setDate(balanceDueAt.getDate() + 7); // 7 days to pay balance

        await this.prisma.order.update({
            where: { id: orderId },
            data: {
                balanceRequestedAt: new Date(),
                balanceDueAt,
            },
        });

        // Notify buyer
        const buyerName = [order.buyer.firstName, order.buyer.lastName]
            .filter(Boolean).join(' ') || order.buyer.email;

        await this.prisma.notification.create({
            data: {
                userId: order.buyerId,
                type: 'balance_due',
                title: 'Balance Payment Due',
                message: `Balance payment of $${balanceDue.toFixed(2)} is due for order #${order.orderNumber}. Please pay within 7 days.`,
                link: `/app/orders`,
            },
        });

        return {
            orderId,
            orderNumber: order.orderNumber,
            totalAmount: Number(order.totalAmount),
            paidAmount: Number(order.paidAmount),
            balanceDue,
            balanceDueAt,
        };
    }

    /**
     * Calculate commission for a delivered order.
     * Triggered when order status changes to 'delivered'.
     */
    async calculateCommission(orderId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                salesPerson: true,
                items: true,
                commissionRecords: true,
                payments: true,
            },
        });

        if (!order) throw new NotFoundException('Order not found');
        if (!order.salesPersonId || !order.salesPerson) {
            return { message: 'No sales person assigned to this order' };
        }

        // Calculate delivered value
        const deliveredValue = order.items.reduce((sum, item) => {
            return sum + (Number(item.unitPrice) * item.deliveredQty);
        }, 0);

        // If nothing delivered yet, use total paid amount as proxy
        const valueForCommission = deliveredValue > 0
            ? deliveredValue
            : Number(order.deliveredAmount) > 0
                ? Number(order.deliveredAmount)
                : Number(order.totalAmount);
        const structureConfig = await this.getActiveCommissionConfig();
        const baseRate = structureConfig.baseRate ?? Number(order.salesPerson.commissionRate || 5);
        const highValueRate = structureConfig.highValueRate ?? baseRate;
        const threshold = structureConfig.highValueThreshold ?? 500000;
        const paidBonusRate = structureConfig.paidBonusRate ?? 0;

        const selectedRate = valueForCommission >= threshold ? highValueRate : baseRate;
        const isPaid = Boolean(this.inferPaymentConfirmedAt({
            paymentConfirmedAt: order.paymentConfirmedAt,
            payments: order.payments.map((p) => ({
                status: p.status,
                paidAt: p.paidAt,
                createdAt: p.createdAt,
            })),
            paidAmount: order.paidAmount,
            totalAmount: order.totalAmount,
        }));
        const effectiveRate = selectedRate + (isPaid ? paidBonusRate : 0);
        const commissionAmount = valueForCommission * (effectiveRate / 100);

        const commission = order.commissionRecords?.[0]
            ? await this.prisma.commissionRecord.update({
                where: { id: order.commissionRecords[0].id },
                data: {
                    commissionRate: effectiveRate,
                    deliveredValue: valueForCommission,
                    amount: commissionAmount,
                    status: isPaid ? 'paid' : 'pending',
                    calculatedAt: new Date(),
                },
            })
            : await this.prisma.commissionRecord.create({
                data: {
                    orderId,
                    salesPersonId: order.salesPersonId,
                    commissionRate: effectiveRate,
                    deliveredValue: valueForCommission,
                    amount: commissionAmount,
                    status: isPaid ? 'paid' : 'pending',
                },
            });

        // Notify sales person
        await this.prisma.notification.create({
            data: {
                userId: order.salesPersonId,
                type: 'commission_earned',
                title: 'Commission Earned',
                message: `You earned $${commissionAmount.toFixed(2)} commission on order #${order.orderNumber}.`,
                link: `/sales/commissions`,
            },
        });

        return commission;
    }

    private async getActiveCommissionConfig() {
        const activeRows = await this.prisma.commissionStructure.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
        const pick = (name: string) => {
            const row = activeRows.find((r) => r.name === name);
            return row ? Number(row.value) : null;
        };
        return {
            baseRate: pick('baseRate'),
            highValueRate: pick('highValueRate'),
            highValueThreshold: pick('highValueThreshold'),
            paidBonusRate: pick('paidBonusRate'),
        };
    }

    /**
     * Get assigned requests for this sales person
     * (carts that have been validated and forwarded by ops).
     */
    async getAssignedRequests(salesPersonId: string) {
        const carts = await this.prisma.intendedCart.findMany({
            where: {
                assignedSalesId: salesPersonId,
                status: { not: 'draft' },
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        companyName: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                session: {
                    select: {
                        thumbnailUrl: true,
                        selectedCategory: true,
                        geminiAttributes: true,
                    },
                },
                items: {
                    include: {
                        recommendationItem: {
                            include: {
                                inventorySku: true,
                                manufacturerItem: true,
                            },
                        },
                    },
                },
                quotations: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                assignedSales: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                validatedByOps: {
                    select: { id: true, firstName: true, lastName: true },
                },
            },
            orderBy: { assignedAt: 'desc' },
        });

        const cartIds = carts.map((c) => c.id);
        const orders = cartIds.length > 0
            ? await this.prisma.order.findMany({
                where: { quotation: { cartId: { in: cartIds } } },
                include: {
                    payments: true,
                    quotation: { select: { cartId: true } },
                },
                orderBy: { createdAt: 'desc' },
            })
            : [];

        const latestOrderByCart = new Map<string, (typeof orders)[number]>();
        for (const order of orders) {
            const orderCartId = order.quotation?.cartId;
            if (!orderCartId || latestOrderByCart.has(orderCartId)) continue;
            latestOrderByCart.set(orderCartId, order);
        }

        return carts.map((cart) => ({
            ...cart,
            order: this.withInferredWorkflowMetadata(latestOrderByCart.get(cart.id) || null),
        }));
    }

    /**
     * Get the full quotation tracker / timeline for a specific cart.
     * Returns all phases with timestamps for the tracker UI.
     */
    async getQuotationTracker(cartId: string) {
        const cart = await this.prisma.intendedCart.findUnique({
            where: { id: cartId },
            include: {
                user: {
                    select: { id: true, email: true, companyName: true, firstName: true, lastName: true },
                },
                items: {
                    include: {
                        recommendationItem: {
                            include: { inventorySku: true, manufacturerItem: true },
                        },
                    },
                },
                assignedSales: {
                    select: { id: true, firstName: true, lastName: true, email: true },
                },
                validatedByOps: {
                    select: { id: true, firstName: true, lastName: true },
                },
                quotations: {
                    include: {
                        items: true,
                        createdBy: { select: { id: true, firstName: true, lastName: true } },
                        negotiation: {
                            include: {
                                rounds: {
                                    orderBy: { roundNumber: 'asc' },
                                    include: {
                                        items: true,
                                        proposedBy: { select: { id: true, firstName: true, lastName: true, userType: true } },
                                    },
                                },
                            },
                        },
                        orders: {
                            include: {
                                payments: true,
                                shipments: true,
                                procurement: { include: { supplier: true } },
                                commissionRecords: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                messages: {
                    include: {
                        sender: { select: { id: true, firstName: true, lastName: true, userType: true } },
                    },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!cart) throw new NotFoundException('Cart not found');

        // Build timeline
        const timeline = [];

        // Phase 1: Submission
        if (cart.submittedAt) {
            timeline.push({
                phase: 1,
                label: 'Request Submitted',
                status: 'completed',
                timestamp: cart.submittedAt,
                actor: 'buyer',
                actorName: [cart.user.firstName, cart.user.lastName].filter(Boolean).join(' ') || cart.user.email,
            });
        }

        // Phase 2: Ops Validation
        if (cart.validatedAt) {
            timeline.push({
                phase: 2,
                label: 'Inventory Validated',
                status: 'completed',
                timestamp: cart.validatedAt,
                actor: 'operations',
                actorName: cart.validatedByOps
                    ? [cart.validatedByOps.firstName, cart.validatedByOps.lastName].filter(Boolean).join(' ')
                    : 'Operations',
                details: {
                    itemsValidated: cart.items.filter(i => i.validatedAt).length,
                    totalItems: cart.items.length,
                },
            });
        } else if (cart.status === 'submitted') {
            timeline.push({
                phase: 2,
                label: 'Awaiting Inventory Validation',
                status: 'pending',
                actor: 'operations',
            });
        }

        // Phase 2b: Assignment
        if (cart.assignedAt && cart.assignedSales) {
            timeline.push({
                phase: 2.5,
                label: 'Assigned to Sales',
                status: 'completed',
                timestamp: cart.assignedAt,
                actor: 'operations',
                details: {
                    salesPerson: [cart.assignedSales.firstName, cart.assignedSales.lastName].filter(Boolean).join(' '),
                },
            });
        }

        // Quotation phases
        const latestQuotation = cart.quotations[0];
        const quotationWithLatestOrder = cart.quotations
            .flatMap((q) => q.orders.map((o) => ({ quotation: q, order: o })))
            .sort((a, b) => new Date(b.order.createdAt).getTime() - new Date(a.order.createdAt).getTime())[0];
        const latestOrder = quotationWithLatestOrder?.order || null;
        const acceptedQuotationForOrder = quotationWithLatestOrder?.quotation || null;
        if (latestQuotation) {
            // Phase 3: Draft
            timeline.push({
                phase: 3,
                label: 'Quotation Created',
                status: 'completed',
                timestamp: latestQuotation.createdAt,
                actor: 'sales',
                actorName: latestQuotation.createdBy
                    ? [latestQuotation.createdBy.firstName, latestQuotation.createdBy.lastName].filter(Boolean).join(' ')
                    : 'Sales',
            });

            // Phase 4: Sent
            if (latestQuotation.sentAt) {
                timeline.push({
                    phase: 4,
                    label: 'Quotation Sent',
                    status: 'completed',
                    timestamp: latestQuotation.sentAt,
                    actor: 'sales',
                    details: {
                        expiresAt: latestQuotation.expiresAt,
                        quotedTotal: Number(latestQuotation.quotedTotal),
                    },
                });
            }

            // Phase 5: Negotiation
            if (latestQuotation.negotiation) {
                const neg = latestQuotation.negotiation;
                timeline.push({
                    phase: 5,
                    label: `Negotiation (${neg.rounds.length} rounds)`,
                    status: neg.status === 'accepted' ? 'completed' : neg.status === 'rejected' || neg.status === 'closed' ? 'rejected' : 'active',
                    timestamp: neg.createdAt,
                    actor: 'both',
                    details: {
                        status: neg.status,
                        rounds: neg.rounds.length,
                        lastRoundTotal: neg.rounds.length > 0
                            ? Number(neg.rounds[neg.rounds.length - 1].proposedTotal)
                            : null,
                    },
                });
            }

            // Phase 6: Accepted + Order
            if (latestQuotation.status === 'accepted' || acceptedQuotationForOrder?.status === 'accepted') {
                timeline.push({
                    phase: 6,
                    label: 'Quotation Accepted',
                    status: 'completed',
                    timestamp: acceptedQuotationForOrder?.updatedAt || latestQuotation.updatedAt,
                    actor: 'buyer',
                });
            }

            if (latestQuotation.status === 'rejected') {
                timeline.push({
                    phase: 7,
                    label: 'Quotation Rejected',
                    status: 'rejected',
                    timestamp: latestQuotation.updatedAt,
                    actor: 'buyer',
                });
            }

            if (latestQuotation.status === 'expired') {
                timeline.push({
                    phase: 4.5,
                    label: 'Quotation Expired',
                    status: 'expired',
                    timestamp: latestQuotation.expiresAt,
                    actor: 'system',
                });
            }

            // Order phases
            const order = latestOrder;
            if (order) {
                const opsFinalCheckStatus = this.inferOpsFinalCheckStatus(order);
                if (opsFinalCheckStatus === 'pending') {
                    timeline.push({
                        phase: 6.1,
                        label: 'Ops Final Check Pending',
                        status: 'active',
                        timestamp: order.createdAt,
                        actor: 'operations',
                    });
                }

                if (opsFinalCheckStatus === 'approved' && order.opsFinalCheckedAt) {
                    timeline.push({
                        phase: 6.2,
                        label: 'Ops Final Check Approved',
                        status: 'completed',
                        timestamp: order.opsFinalCheckedAt,
                        actor: 'operations',
                    });
                }

                if (opsFinalCheckStatus === 'rejected') {
                    timeline.push({
                        phase: 6.2,
                        label: 'Ops Final Check Rejected',
                        status: 'rejected',
                        timestamp: order.opsFinalCheckedAt || order.updatedAt,
                        actor: 'operations',
                        details: {
                            reason: order.opsFinalCheckReason || 'No reason provided',
                        },
                    });
                }

                if (order.paymentLinkSentAt) {
                    timeline.push({
                        phase: 6.4,
                        label: 'Payment Link Sent',
                        status: 'completed',
                        timestamp: order.paymentLinkSentAt,
                        actor: 'sales',
                    });
                }

                // Payment
                const paidPayments = order.payments.filter(p => p.status === 'paid');
                if (paidPayments.length > 0) {
                    timeline.push({
                        phase: 6.5,
                        label: 'Payment Received',
                        status: 'completed',
                        timestamp: paidPayments[0].paidAt,
                        actor: 'buyer',
                        details: {
                            paidAmount: Number(order.paidAmount),
                            totalAmount: Number(order.totalAmount),
                            method: paidPayments[0].method,
                        },
                    });
                }

                if (order.paymentConfirmedAt && paidPayments.length === 0) {
                    timeline.push({
                        phase: 6.6,
                        label: 'Payment Confirmed',
                        status: 'completed',
                        timestamp: order.paymentConfirmedAt,
                        actor: 'sales',
                        details: {
                            source: order.paymentConfirmationSource || 'manual_reconciliation',
                        },
                    });
                }

                if (order.forwardedToOpsAt) {
                    timeline.push({
                        phase: 6.7,
                        label: 'Forwarded to Ops for Fulfillment',
                        status: 'completed',
                        timestamp: order.forwardedToOpsAt,
                        actor: 'sales',
                    });
                }

                // Confirmed
                if (['confirmed', 'in_procurement', 'shipped', 'partially_shipped', 'delivered', 'partially_delivered'].includes(order.status)) {
                    timeline.push({
                        phase: 6.8,
                        label: 'Order Confirmed',
                        status: 'completed',
                        timestamp: order.updatedAt,
                        actor: 'system',
                        details: { orderNumber: order.orderNumber },
                    });
                }

                // Procurement
                if (order.procurement.length > 0) {
                    timeline.push({
                        phase: 8,
                        label: 'Procurement',
                        status: order.procurement.every(p => p.status === 'received') ? 'completed' : 'active',
                        timestamp: order.procurement[0].orderedAt || order.procurement[0].createdAt,
                        actor: 'operations',
                        details: {
                            total: order.procurement.length,
                            received: order.procurement.filter(p => p.status === 'received').length,
                        },
                    });
                }

                // Shipment
                if (order.shipments.length > 0) {
                    const latestShipment = order.shipments[0];
                    timeline.push({
                        phase: 8.5,
                        label: 'Shipped',
                        status: latestShipment.status === 'delivered' ? 'completed' : 'active',
                        timestamp: latestShipment.shippedAt || latestShipment.createdAt,
                        actor: 'operations',
                        details: {
                            trackingNumber: latestShipment.trackingNumber,
                            carrier: latestShipment.carrier,
                            status: latestShipment.status,
                        },
                    });
                }

                // Delivered
                if (order.status === 'delivered') {
                    timeline.push({
                        phase: 9,
                        label: 'Delivered',
                        status: 'completed',
                        timestamp: order.shipments.find(s => s.deliveredAt)?.deliveredAt || order.updatedAt,
                        actor: 'system',
                    });
                }

                // Commission
                if (order.commissionRecords && order.commissionRecords.length > 0) {
                    timeline.push({
                        phase: 9.5,
                        label: 'Commission Calculated',
                        status: 'completed',
                        timestamp: order.commissionRecords[0].createdAt,
                        actor: 'system',
                        details: {
                            amount: Number(order.commissionRecords[0].amount),
                            rate: Number(order.commissionRecords[0].commissionRate),
                        },
                    });
                }

                // Recheck
                if (order.status === 'recheck') {
                    timeline.push({
                        phase: 6.9,
                        label: 'Payment Expired — Recheck Required',
                        status: 'expired',
                        timestamp: order.updatedAt,
                        actor: 'system',
                    });
                }
            }
        }

        return {
            cart: {
                id: cart.id,
                status: cart.status,
                buyer: cart.user,
                submittedAt: cart.submittedAt,
                assignedSales: cart.assignedSales,
                validatedByOps: cart.validatedByOps,
                validatedAt: cart.validatedAt,
                itemCount: cart.items.length,
            },
            latestQuotation: latestQuotation ? {
                id: latestQuotation.id,
                quotationNumber: latestQuotation.quotationNumber,
                status: latestQuotation.status,
                quotedTotal: latestQuotation.quotedTotal,
                expiresAt: latestQuotation.expiresAt,
                sentAt: latestQuotation.sentAt,
                items: latestQuotation.items,
                negotiation: latestQuotation.negotiation,
                // Important: bind the latest order in the thread, not only on the newest quotation row.
                // A newer revision may exist after acceptance, while payment/fulfillment belongs to an older accepted quote.
                order: latestOrder || null,
            } : null,
            timeline: [...timeline, ...cart.messages.filter(m => m.content.includes('[System]')).map(m => ({
                phase: 4.1,
                label: 'Prices Adjusted',
                status: 'completed',
                timestamp: m.createdAt,
                actor: 'system',
                details: { update: m.content.replace('[System] ', '') }
            }))].sort((a, b) => {
                if (!a.timestamp) return 1;
                if (!b.timestamp) return 1;
                return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            }),
            messages: cart.messages.filter(m => !m.content.includes('[System]')),
        };
    }
}
