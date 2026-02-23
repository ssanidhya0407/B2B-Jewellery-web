import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SalesService {
    constructor(private readonly prisma: PrismaService) {}

    // ─── Dashboard Metrics ───

    async getDashboardMetrics(salesPersonId: string) {
        const [
            assignedRequests,
            pendingQuotes,
            activeNegotiations,
            totalCommission,
        ] = await Promise.all([
            this.prisma.intendedCart.count({
                where: { status: { in: ['submitted', 'under_review'] } },
            }),
            this.prisma.quotation.count({
                where: { createdById: salesPersonId, status: { in: ['draft', 'sent'] } },
            }),
            this.prisma.intendedCart.count({
                where: { status: 'quoted' },
            }),
            this.prisma.commission.aggregate({
                where: { salesPersonId, status: 'paid' },
                _sum: { commissionAmount: true },
            }),
        ]);

        return {
            assignedRequests,
            pendingQuotes,
            activeNegotiations,
            totalCommission: Number(totalCommission._sum.commissionAmount || 0),
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
        return cart;
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
        const commissions = await this.prisma.commission.findMany({
            where: { salesPersonId },
            include: {
                order: { select: { orderNumber: true, totalAmount: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const summary = await this.prisma.commission.groupBy({
            by: ['status'],
            where: { salesPersonId },
            _sum: { commissionAmount: true },
        });

        return { commissions, summary };
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
                commissions: true,
            },
        });

        if (!order) throw new NotFoundException('Order not found');
        if (!order.salesPersonId || !order.salesPerson) {
            return { message: 'No sales person assigned to this order' };
        }

        // Don't double-calculate
        if (order.commissions.length > 0) {
            return { message: 'Commission already calculated', commissions: order.commissions };
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

        const commissionRate = Number(order.salesPerson.commissionRate || 5);
        const commissionAmount = valueForCommission * (commissionRate / 100);

        const commission = await this.prisma.commission.create({
            data: {
                orderId,
                salesPersonId: order.salesPersonId,
                commissionRate,
                deliveredValue: valueForCommission,
                commissionAmount,
                status: 'pending',
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

    /**
     * Get assigned requests for this sales person
     * (carts that have been validated and forwarded by ops).
     */
    async getAssignedRequests(salesPersonId: string) {
        return this.prisma.intendedCart.findMany({
            where: {
                assignedSalesId: salesPersonId,
                status: { in: ['under_review', 'quoted'] },
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
                                commissions: true,
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
            if (latestQuotation.status === 'accepted') {
                timeline.push({
                    phase: 6,
                    label: 'Quotation Accepted',
                    status: 'completed',
                    timestamp: latestQuotation.updatedAt,
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
            const order = latestQuotation.orders[0];
            if (order) {
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
                if (order.commissions.length > 0) {
                    timeline.push({
                        phase: 9.5,
                        label: 'Commission Calculated',
                        status: 'completed',
                        timestamp: order.commissions[0].createdAt,
                        actor: 'system',
                        details: {
                            amount: Number(order.commissions[0].commissionAmount),
                            rate: Number(order.commissions[0].commissionRate),
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
                order: latestQuotation.orders[0] || null,
            } : null,
            timeline: timeline.sort((a, b) => {
                if (!a.timestamp) return 1;
                if (!b.timestamp) return 1;
                return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
            }),
            messages: cart.messages,
        };
    }
}
