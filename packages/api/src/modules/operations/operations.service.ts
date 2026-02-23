import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class OperationsService {
    constructor(private readonly prisma: PrismaService) {}

    // ─── Dashboard Metrics ───

    async getDashboardMetrics() {
        const [
            newQuoteRequests,
            pendingQuotes,
            activeOrders,
            totalInventory,
            pendingApproval,
        ] = await Promise.all([
            this.prisma.intendedCart.count({ where: { status: 'submitted' } }),
            this.prisma.quotation.count({ where: { status: { in: ['draft', 'sent'] } } }),
            this.prisma.order.count({ where: { status: { notIn: ['delivered', 'cancelled'] } } }),
            this.prisma.inventorySku.count({ where: { isActive: true } }),
            this.prisma.inventorySku.count({ where: { isActive: false } }),
        ]);

        return {
            newQuoteRequests,
            pendingQuotes,
            activeOrders,
            totalInventory,
            pendingApproval,
        };
    }

    // ─── System Health ───

    async getSystemHealth() {
        const suppliers = await this.prisma.supplier.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                type: true,
                apiStatus: true,
                lastSyncAt: true,
            },
        });

        const scraperConfig = await this.prisma.systemConfig.findUnique({
            where: { key: 'alibaba_scraper' },
        });

        return {
            brandConnections: suppliers.filter((s) => s.type === 'brand'),
            alibabaStatus: scraperConfig?.value || {
                status: 'not_configured',
                lastScrapeAt: null,
                itemsScraped: 0,
                errors: [],
            },
        };
    }

    // ─── Markup Management ───

    async getMarkupConfigs() {
        return this.prisma.marginConfiguration.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            include: { createdBy: { select: { firstName: true, lastName: true, email: true } } },
        });
    }

    async upsertMarkup(data: {
        category?: string;
        sourceType?: string;
        marginPercentage: number;
        minMarkup?: number;
        maxMarkup?: number;
    }, userId: string) {
        return this.prisma.marginConfiguration.create({
            data: {
                category: data.category || null,
                sourceType: data.sourceType || null,
                marginPercentage: data.marginPercentage,
                minMarkup: data.minMarkup,
                maxMarkup: data.maxMarkup,
                createdById: userId,
            },
        });
    }

    // ─── Alibaba Scraping Config ───

    async getScraperConfig() {
        const config = await this.prisma.systemConfig.findUnique({
            where: { key: 'alibaba_scraper' },
        });
        return config?.value || {
            priceLimit: 5000,
            categories: ['ring', 'necklace', 'earring', 'bracelet', 'pendant', 'bangle'],
            frequency: 'daily',
            enabled: false,
        };
    }

    async updateScraperConfig(value: Record<string, unknown>, userId: string) {
        return this.prisma.systemConfig.upsert({
            where: { key: 'alibaba_scraper' },
            update: { value: value as any, updatedBy: userId },
            create: { key: 'alibaba_scraper', value: value as any, updatedBy: userId },
        });
    }

    // ─── Supplier Management ───

    async getSuppliers() {
        return this.prisma.supplier.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async createSupplier(data: {
        name: string;
        type?: string;
        contactEmail?: string;
        contactPhone?: string;
        website?: string;
        apiEndpoint?: string;
        categories?: string[];
        notes?: string;
    }) {
        return this.prisma.supplier.create({ data: data as any });
    }

    async updateSupplier(id: string, data: Record<string, unknown>) {
        return this.prisma.supplier.update({
            where: { id },
            data: {
                ...(typeof data.name === 'string' ? { name: data.name } : {}),
                ...(data.contactEmail !== undefined ? { contactEmail: data.contactEmail as string } : {}),
                ...(data.contactPhone !== undefined ? { contactPhone: data.contactPhone as string } : {}),
                ...(data.website !== undefined ? { website: data.website as string } : {}),
                ...(data.apiEndpoint !== undefined ? { apiEndpoint: data.apiEndpoint as string } : {}),
                ...(data.apiStatus !== undefined ? { apiStatus: data.apiStatus as string } : {}),
                ...(Array.isArray(data.categories) ? { categories: data.categories as string[] } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive as boolean } : {}),
                ...(data.notes !== undefined ? { notes: data.notes as string } : {}),
            },
        });
    }

    // ─── Product Approval ───

    async getPendingProducts() {
        const [inventory, manufacturers] = await Promise.all([
            this.prisma.inventorySku.findMany({
                where: { isActive: false },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.manufacturerCatalog.findMany({
                where: { isVerified: false },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        return { inventory, manufacturers };
    }

    async approveProduct(type: 'inventory' | 'manufacturer', id: string) {
        if (type === 'inventory') {
            return this.prisma.inventorySku.update({ where: { id }, data: { isActive: true } });
        }
        return this.prisma.manufacturerCatalog.update({ where: { id }, data: { isVerified: true } });
    }

    async rejectProduct(type: 'inventory' | 'manufacturer', id: string) {
        if (type === 'inventory') {
            return this.prisma.inventorySku.delete({ where: { id } });
        }
        return this.prisma.manufacturerCatalog.delete({ where: { id } });
    }

    // ─── Procurement & Fulfillment ───

    async getOrders(status?: string) {
        return this.prisma.order.findMany({
            where: status ? { status: status as any } : undefined,
            include: {
                buyer: { select: { id: true, email: true, companyName: true, firstName: true, lastName: true } },
                salesPerson: { select: { id: true, email: true, firstName: true, lastName: true } },
                items: true,
                shipments: true,
                procurement: { include: { supplier: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createProcurementRecord(data: {
        orderId: string;
        supplierId?: string;
        source: string;
        poNumber?: string;
        notes?: string;
        expectedAt?: string;
    }) {
        return this.prisma.procurementRecord.create({
            data: {
                orderId: data.orderId,
                supplierId: data.supplierId,
                source: data.source,
                status: 'ordered',
                poNumber: data.poNumber,
                notes: data.notes,
                orderedAt: new Date(),
                expectedAt: data.expectedAt ? new Date(data.expectedAt) : undefined,
            },
        });
    }

    async updateProcurementStatus(id: string, status: string, notes?: string) {
        const data: any = { status };
        if (notes) data.notes = notes;
        if (status === 'received') data.receivedAt = new Date();

        const record = await this.prisma.procurementRecord.update({ where: { id }, data });

        // If received from internal inventory, deduct stock
        if (status === 'received') {
            await this.deductInventoryForProcurement(id);
        }

        return record;
    }

    // ─── Inventory Deduction (triggered on procurement receipt) ───

    private async deductInventoryForProcurement(procurementId: string) {
        const procurement = await this.prisma.procurementRecord.findUnique({
            where: { id: procurementId },
            include: { orderItems: true },
        });

        if (!procurement || procurement.source !== 'inventory') return;

        for (const orderItem of procurement.orderItems) {
            if (orderItem.skuCode) {
                const sku = await this.prisma.inventorySku.findFirst({
                    where: { skuCode: orderItem.skuCode, isActive: true },
                });
                if (sku) {
                    const newQty = Math.max(0, sku.availableQuantity - orderItem.quantity);
                    await this.prisma.inventorySku.update({
                        where: { id: sku.id },
                        data: { availableQuantity: newQty },
                    });
                }
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // QUOTATION WORKFLOW — Phase 2: Validate Inventory & Forward
    // ═══════════════════════════════════════════════════════════════

    /**
     * Phase 2A: Validate inventory for every cart item.
     * Performs a real DB check for each item — quantity-wise —
     * and returns a comprehensive report categorised into:
     *   • fullyAvailable   – requested qty fully covered by internal stock
     *   • partiallyAvailable – some internal stock, but not enough
     *   • needsExternalManufacturer – must be sourced from manufacturer / alibaba
     *   • unavailable       – no known source at all
     *
     * Every item row contains the numbers the Ops team needs:
     *   requestedQty, availableQty, shortfall, unit cost, lead time, MOQ,
     *   manufacturer contact info (when applicable), etc.
     */
    async validateCartInventory(cartId: string, userId: string) {
        const cart = await this.prisma.intendedCart.findUnique({
            where: { id: cartId },
            include: {
                items: {
                    include: {
                        recommendationItem: {
                            include: {
                                inventorySku: true,
                                manufacturerItem: {
                                    include: { manufacturer: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!cart) throw new Error('Cart not found');
        if (!['submitted', 'under_review'].includes(cart.status)) {
            throw new Error('Cart is not in a validatable state');
        }

        const validationResults: Array<Record<string, any>> = [];

        for (const item of cart.items) {
            const rec = item.recommendationItem;
            const requestedQty = item.quantity;

            let inventoryStatus: string;
            let availableSource: string;
            let availableQty = 0;
            let shortfall = 0;

            // Rich detail fields
            let skuCode: string | null = null;
            let productName: string = 'Unknown';
            let imageUrl: string | null = null;
            let primaryMetal: string | null = null;
            let unitCostMin: number | null = null;
            let unitCostMax: number | null = null;
            let moq: number | null = null;
            let leadTimeDays: number | null = null;
            let leadTimeDisplay: string | null = null;
            let qualityTier: string | null = null;
            let lastStockCheck: Date | null = null;

            // Manufacturer contact info (when external sourcing needed)
            let manufacturerInfo: Record<string, any> | null = null;

            if (rec.sourceType === 'inventory' && rec.inventorySku) {
                // ── Internal inventory: real DB quantity check ──
                const sku = rec.inventorySku;
                productName = sku.name;
                skuCode = sku.skuCode;
                imageUrl = sku.imageUrl;
                primaryMetal = sku.primaryMetal;
                unitCostMin = Number(sku.baseCost);
                unitCostMax = Number(sku.baseCost);
                moq = sku.moq;
                leadTimeDays = sku.leadTimeDays;
                availableQty = sku.availableQuantity;
                availableSource = 'internal';

                if (availableQty >= requestedQty) {
                    inventoryStatus = 'in_stock';
                    shortfall = 0;
                } else if (availableQty > 0) {
                    inventoryStatus = 'low_stock';
                    shortfall = requestedQty - availableQty;
                } else {
                    inventoryStatus = 'out_of_stock';
                    shortfall = requestedQty;
                }
            } else if (rec.manufacturerItem) {
                // ── External manufacturer / alibaba ──
                const mfItem = rec.manufacturerItem;
                productName = mfItem.name;
                imageUrl = mfItem.imageUrl;
                primaryMetal = mfItem.primaryMetal;
                unitCostMin = mfItem.baseCostMin ? Number(mfItem.baseCostMin) : null;
                unitCostMax = mfItem.baseCostMax ? Number(mfItem.baseCostMax) : null;
                moq = mfItem.moq;
                leadTimeDays = mfItem.leadTimeDays;
                qualityTier = mfItem.qualityTier;
                lastStockCheck = mfItem.lastStockCheck;
                availableSource = rec.sourceType === 'alibaba' ? 'alibaba' : 'manufacturer';

                // Build manufacturer contact card
                if (mfItem.manufacturer) {
                    const mf = mfItem.manufacturer;
                    manufacturerInfo = {
                        id: mf.id,
                        companyName: mf.companyName,
                        contactPerson: mf.contactPerson,
                        email: mf.email,
                        phone: mf.phone,
                        city: mf.city,
                        country: mf.country,
                        website: mf.website,
                        qualityTier: mf.qualityTier,
                        minOrderValue: mf.minOrderValue ? Number(mf.minOrderValue) : null,
                        avgLeadTimeDays: mf.avgLeadTimeDays,
                        isVerified: mf.isVerified,
                    };
                }

                if (!mfItem.isVerified) {
                    inventoryStatus = 'unavailable';
                    availableQty = 0;
                    shortfall = requestedQty;
                } else if (mfItem.stockStatus === 'in_stock') {
                    inventoryStatus = 'in_stock';
                    availableQty = requestedQty; // manufacturer confirms availability
                    shortfall = 0;
                } else if (mfItem.stockStatus === 'made_to_order') {
                    inventoryStatus = 'made_to_order';
                    availableQty = 0; // nothing on shelf — will be produced
                    shortfall = requestedQty;
                } else if (mfItem.stockStatus === 'low_stock') {
                    inventoryStatus = 'low_stock';
                    availableQty = mfItem.moq; // best guess
                    shortfall = requestedQty > mfItem.moq ? requestedQty - mfItem.moq : 0;
                } else {
                    inventoryStatus = 'unavailable';
                    availableQty = 0;
                    shortfall = requestedQty;
                }
            } else {
                inventoryStatus = 'unavailable';
                availableSource = 'unknown';
                availableQty = 0;
                shortfall = requestedQty;
            }

            if (leadTimeDays) {
                if (leadTimeDays <= 3) leadTimeDisplay = `${leadTimeDays} days (express)`;
                else if (leadTimeDays <= 14) leadTimeDisplay = `${leadTimeDays} days`;
                else if (leadTimeDays <= 30) leadTimeDisplay = `${Math.ceil(leadTimeDays / 7)} weeks`;
                else leadTimeDisplay = `${Math.round(leadTimeDays / 30)} month(s)`;
            }

            // Persist validation to DB
            await this.prisma.cartItem.update({
                where: { id: item.id },
                data: {
                    inventoryStatus,
                    availableSource,
                    validatedQuantity: availableQty,
                    validatedAt: new Date(),
                    validatedById: userId,
                },
            });

            validationResults.push({
                cartItemId: item.id,
                productName,
                skuCode,
                imageUrl,
                primaryMetal,
                sourceType: rec.sourceType,

                // ── Quantity report ──
                requestedQty,
                availableQty,
                shortfall,
                inventoryStatus,
                availableSource,

                // ── Pricing & logistics ──
                unitCostMin,
                unitCostMax,
                moq,
                leadTimeDays,
                leadTimeDisplay,
                qualityTier,
                lastStockCheck,

                // ── Manufacturer / supplier contact ──
                manufacturerInfo,
            });
        }

        // ── Update cart status ──
        await this.prisma.intendedCart.update({
            where: { id: cartId },
            data: {
                status: 'under_review',
                validatedByOpsId: userId,
                validatedAt: new Date(),
            },
        });

        // ── Build categorised report ──
        const fullyAvailable = validationResults.filter(
            r => r.inventoryStatus === 'in_stock' && r.availableSource === 'internal',
        );
        const partiallyAvailable = validationResults.filter(
            r => r.inventoryStatus === 'low_stock' && r.availableSource === 'internal',
        );
        const needsExternalManufacturer = validationResults.filter(
            r => ['manufacturer', 'alibaba'].includes(r.availableSource) ||
                 (r.inventoryStatus === 'out_of_stock' && r.availableSource === 'internal'),
        );
        const unavailable = validationResults.filter(
            r => r.inventoryStatus === 'unavailable',
        );

        // Aggregate cost estimate
        const estimatedInternalCost = fullyAvailable.reduce(
            (sum, r) => sum + (r.unitCostMin || 0) * r.requestedQty, 0,
        ) + partiallyAvailable.reduce(
            (sum, r) => sum + (r.unitCostMin || 0) * r.availableQty, 0,
        );

        const estimatedExternalCostMin = needsExternalManufacturer.reduce(
            (sum, r) => sum + (r.unitCostMin || 0) * r.requestedQty, 0,
        );
        const estimatedExternalCostMax = needsExternalManufacturer.reduce(
            (sum, r) => sum + (r.unitCostMax || r.unitCostMin || 0) * r.requestedQty, 0,
        );

        const longestLeadTimeDays = Math.max(
            ...validationResults.map(r => r.leadTimeDays || 0), 0,
        );

        return {
            cartId,
            status: 'under_review',
            validatedBy: userId,
            validatedAt: new Date().toISOString(),

            // Full item-level detail
            items: validationResults,

            // Categorised report
            report: {
                fullyAvailable,
                partiallyAvailable,
                needsExternalManufacturer,
                unavailable,
            },

            // Summary counters
            summary: {
                total: validationResults.length,
                totalRequestedQty: validationResults.reduce((s, r) => s + r.requestedQty, 0),
                totalAvailableQty: validationResults.reduce((s, r) => s + r.availableQty, 0),
                totalShortfall: validationResults.reduce((s, r) => s + r.shortfall, 0),

                fullyAvailable: fullyAvailable.length,
                partiallyAvailable: partiallyAvailable.length,
                needsExternalManufacturer: needsExternalManufacturer.length,
                unavailable: unavailable.length,

                estimatedInternalCost: Math.round(estimatedInternalCost * 100) / 100,
                estimatedExternalCostMin: Math.round(estimatedExternalCostMin * 100) / 100,
                estimatedExternalCostMax: Math.round(estimatedExternalCostMax * 100) / 100,
                longestLeadTimeDays,
            },
        };
    }

    /**
     * Phase 2B: Forward validated cart to a specific sales person.
     */
    async forwardToSales(cartId: string, salesPersonId: string, opsUserId: string) {
        const cart = await this.prisma.intendedCart.findUnique({
            where: { id: cartId },
            include: { user: true },
        });

        if (!cart) throw new Error('Cart not found');
        if (!['submitted', 'under_review'].includes(cart.status)) {
            throw new Error('Cart must be in submitted or under_review status to forward to sales');
        }

        // Verify sales person exists and is a sales user
        const salesPerson = await this.prisma.user.findUnique({
            where: { id: salesPersonId },
        });
        if (!salesPerson || !['sales', 'admin'].includes(salesPerson.userType)) {
            throw new Error('Invalid sales person');
        }

        // Assign to sales
        const updated = await this.prisma.intendedCart.update({
            where: { id: cartId },
            data: {
                assignedSalesId: salesPersonId,
                assignedAt: new Date(),
            },
        });

        // Notify the sales person
        const buyerName = [cart.user.firstName, cart.user.lastName].filter(Boolean).join(' ')
            || cart.user.companyName || cart.user.email;

        await this.prisma.notification.create({
            data: {
                userId: salesPersonId,
                type: 'request_validated',
                title: 'New Request Assigned',
                message: `Request from ${buyerName} has been validated and assigned to you. Ready for quoting.`,
                link: `/sales/requests/${cartId}`,
            },
        });

        return updated;
    }

    /**
     * Get all sales team members for assignment dropdown.
     */
    async getSalesTeamMembers() {
        return this.prisma.user.findMany({
            where: { userType: { in: ['sales', 'admin'] }, isActive: true },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                userType: true,
                _count: { select: { salesOrders: true } },
            },
            orderBy: { firstName: 'asc' },
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // QUOTATION WORKFLOW — Payment Expiry & Recheck
    // ═══════════════════════════════════════════════════════════════

    /**
     * Cron job: Expire overdue payments and move orders to recheck.
     * Should run every hour.
     */
    async expireOverduePayments() {
        const now = new Date();

        // 1. Expire pending payments past their deadline
        const expiredPayments = await this.prisma.payment.findMany({
            where: {
                status: { in: ['pending', 'processing'] },
                expiresAt: { lt: now },
            },
            include: {
                order: {
                    include: { buyer: true, salesPerson: true, quotation: true },
                },
            },
        });

        const results = { expiredPayments: 0, recheckOrders: 0, expiredQuotations: 0 };

        for (const payment of expiredPayments) {
            await this.prisma.payment.update({
                where: { id: payment.id },
                data: { status: 'expired' },
            });
            results.expiredPayments++;

            // Move order to recheck if still pending_payment
            if (payment.order.status === 'pending_payment') {
                await this.prisma.order.update({
                    where: { id: payment.orderId },
                    data: { status: 'recheck' },
                });
                results.recheckOrders++;

                // Expire the quotation too
                if (payment.order.quotation) {
                    await this.prisma.quotation.update({
                        where: { id: payment.order.quotationId },
                        data: { status: 'expired' },
                    });
                    results.expiredQuotations++;
                }

                // Notify buyer
                await this.prisma.notification.create({
                    data: {
                        userId: payment.order.buyerId,
                        type: 'payment_expired',
                        title: 'Payment Window Expired',
                        message: `Your payment for order #${payment.order.orderNumber} has expired. The quotation needs to be revalidated.`,
                        link: `/app/orders`,
                    },
                });

                // Notify sales
                if (payment.order.salesPersonId) {
                    await this.prisma.notification.create({
                        data: {
                            userId: payment.order.salesPersonId,
                            type: 'order_recheck',
                            title: 'Order Requires Recheck',
                            message: `Order #${payment.order.orderNumber} payment expired. Inventory revalidation needed.`,
                            link: `/sales/requests`,
                        },
                    });
                }
            }
        }

        // 2. Expire sent quotations past their deadline (no order created)
        const expiredQuotations = await this.prisma.quotation.findMany({
            where: {
                status: 'sent',
                expiresAt: { lt: now },
            },
            include: { cart: true },
        });

        for (const q of expiredQuotations) {
            await this.prisma.quotation.update({
                where: { id: q.id },
                data: { status: 'expired' },
            });
            results.expiredQuotations++;

            if (q.cart?.userId) {
                await this.prisma.notification.create({
                    data: {
                        userId: q.cart.userId,
                        type: 'quote_expired',
                        title: 'Quotation Expired',
                        message: 'Your quotation has expired. Contact sales to request a new one.',
                        link: `/app/quotations`,
                    },
                });
            }
        }

        return results;
    }

    /**
     * Send payment reminders 12 hours before expiry.
     */
    async sendExpiryReminders() {
        const now = new Date();
        const twelveHoursFromNow = new Date(now.getTime() + 12 * 60 * 60 * 1000);
        const thirteenHoursFromNow = new Date(now.getTime() + 13 * 60 * 60 * 1000);

        // Quotations expiring in ~12 hours
        const expiringQuotations = await this.prisma.quotation.findMany({
            where: {
                status: 'sent',
                expiresAt: {
                    gte: twelveHoursFromNow,
                    lt: thirteenHoursFromNow,
                },
            },
            include: { cart: true },
        });

        let reminders = 0;
        for (const q of expiringQuotations) {
            if (q.cart?.userId) {
                await this.prisma.notification.create({
                    data: {
                        userId: q.cart.userId,
                        type: 'quote_expiring',
                        title: '⚠️ Quotation Expiring Soon',
                        message: 'Your quotation expires in 12 hours. Accept or negotiate before it expires.',
                        link: `/app/quotations`,
                    },
                });
                reminders++;
            }
        }

        // Payments expiring in ~12 hours
        const expiringPayments = await this.prisma.payment.findMany({
            where: {
                status: { in: ['pending', 'processing'] },
                expiresAt: {
                    gte: twelveHoursFromNow,
                    lt: thirteenHoursFromNow,
                },
            },
            include: { order: true },
        });

        for (const p of expiringPayments) {
            await this.prisma.notification.create({
                data: {
                    userId: p.order.buyerId,
                    type: 'payment_expiring',
                    title: '⚠️ Payment Window Closing Soon',
                    message: `Complete payment for order #${p.order.orderNumber} within 12 hours.`,
                    link: `/app/orders`,
                },
            });
            reminders++;
        }

        return { reminders };
    }

    // ─── Shipping ───

    async createShipment(data: {
        orderId: string;
        trackingNumber?: string;
        carrier?: string;
        notes?: string;
    }) {
        return this.prisma.shipment.create({
            data: {
                orderId: data.orderId,
                trackingNumber: data.trackingNumber,
                carrier: data.carrier,
                status: 'preparing',
                notes: data.notes,
            },
        });
    }

    async updateShipmentStatus(id: string, status: string, trackingNumber?: string) {
        const data: any = { status };
        if (trackingNumber) data.trackingNumber = trackingNumber;
        if (status === 'shipped') data.shippedAt = new Date();
        if (status === 'delivered') data.deliveredAt = new Date();
        const shipment = await this.prisma.shipment.update({ where: { id }, data, include: { order: { include: { shipments: true } } } });

        // If shipment delivered, check if all shipments for this order are delivered → auto-update order status
        if (status === 'delivered' && shipment.order) {
            const allDelivered = shipment.order.shipments.every(s => s.status === 'delivered');
            if (allDelivered) {
                await this.updateOrderStatus(shipment.orderId, 'delivered');
            } else {
                await this.prisma.order.update({
                    where: { id: shipment.orderId },
                    data: { status: 'partially_delivered' },
                });
            }
        }

        return shipment;
    }

    async updateOrderStatus(orderId: string, status: string) {
        const order = await this.prisma.order.update({
            where: { id: orderId },
            data: { status: status as any },
            include: { salesPerson: { select: { id: true, commissionRate: true } }, commissions: true },
        });

        // Auto-trigger commission calculation when order is delivered
        if (status === 'delivered' && order.commissions.length === 0 && order.salesPersonId) {
            try {
                await this.calculateCommissionForOrder(orderId);
            } catch (e: any) {
                // Log but don't block the status update
                console.error('Auto-commission calculation failed:', e?.message);
            }
        }

        return order;
    }

    /**
     * Calculate commission for a delivered order (mirrors SalesService logic but callable from ops).
     */
    private async calculateCommissionForOrder(orderId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                salesPerson: { select: { id: true, commissionRate: true } },
                items: true,
            },
        });

        if (!order || !order.salesPersonId || !order.salesPerson) return;

        const valueForCommission = order.items.reduce(
            (sum, item) => sum + Number(item.lineTotal || 0),
            0,
        );

        const commissionRate = Number(order.salesPerson.commissionRate || 5);
        const commissionAmount = valueForCommission * (commissionRate / 100);

        await this.prisma.commission.create({
            data: {
                orderId,
                salesPersonId: order.salesPersonId,
                commissionRate,
                deliveredValue: valueForCommission,
                commissionAmount,
                status: 'pending',
            },
        });

        await this.prisma.notification.create({
            data: {
                userId: order.salesPersonId,
                type: 'commission_earned',
                title: 'Commission Earned',
                message: `You earned ₹${commissionAmount.toFixed(2)} commission on order #${order.orderNumber}.`,
                link: `/sales/commissions`,
            },
        });
    }

    // ─── Inventory Management ───

    async listInventory(filters?: { category?: string; search?: string; isActive?: string }) {
        const where: any = {};

        if (filters?.category) {
            where.category = filters.category;
        }

        if (filters?.isActive !== undefined && filters.isActive !== '') {
            where.isActive = filters.isActive === 'true';
        }

        if (filters?.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { skuCode: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        const [items, total] = await Promise.all([
            this.prisma.inventorySku.findMany({
                where,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.inventorySku.count({ where }),
        ]);

        return { items, total };
    }

    async getInventoryById(id: string) {
        return this.prisma.inventorySku.findUnique({ where: { id } });
    }

    async createInventoryItem(data: {
        skuCode: string;
        name: string;
        description?: string;
        category: string;
        primaryMetal?: string;
        stoneTypes?: string[];
        stonePresence?: string;
        primaryShape?: string;
        style?: string;
        complexity?: string;
        baseCost: number;
        moq?: number;
        leadTimeDays?: number;
        availableQuantity?: number;
        imageUrl: string;
    }) {
        return this.prisma.inventorySku.create({
            data: {
                skuCode: data.skuCode,
                name: data.name,
                description: data.description,
                category: data.category,
                primaryMetal: data.primaryMetal,
                stoneTypes: data.stoneTypes || [],
                stonePresence: data.stonePresence,
                primaryShape: data.primaryShape,
                style: data.style,
                complexity: data.complexity,
                baseCost: data.baseCost,
                moq: data.moq || 1,
                leadTimeDays: data.leadTimeDays,
                availableQuantity: data.availableQuantity || 0,
                imageUrl: data.imageUrl,
            },
        });
    }

    async updateInventoryItem(id: string, data: Record<string, unknown>) {
        const updateData: any = {};
        const fields = [
            'name', 'description', 'category', 'primaryMetal', 'stonePresence',
            'primaryShape', 'style', 'complexity', 'imageUrl', 'skuCode',
        ];

        for (const field of fields) {
            if (data[field] !== undefined) updateData[field] = data[field];
        }

        if (Array.isArray(data.stoneTypes)) updateData.stoneTypes = data.stoneTypes;
        if (data.baseCost !== undefined) updateData.baseCost = Number(data.baseCost);
        if (data.moq !== undefined) updateData.moq = Number(data.moq);
        if (data.leadTimeDays !== undefined) updateData.leadTimeDays = data.leadTimeDays === null ? null : Number(data.leadTimeDays);
        if (data.availableQuantity !== undefined) updateData.availableQuantity = Number(data.availableQuantity);
        if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);

        return this.prisma.inventorySku.update({
            where: { id },
            data: updateData,
        });
    }

    async deleteInventoryItem(id: string) {
        // Soft delete — just deactivate
        return this.prisma.inventorySku.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async getInventoryStats() {
        const [total, active, inactive, categories] = await Promise.all([
            this.prisma.inventorySku.count(),
            this.prisma.inventorySku.count({ where: { isActive: true } }),
            this.prisma.inventorySku.count({ where: { isActive: false } }),
            this.prisma.inventorySku.groupBy({
                by: ['category'],
                _count: { category: true },
                where: { isActive: true },
            }),
        ]);

        return {
            total,
            active,
            inactive,
            categories: categories.map((c) => ({ name: c.category, count: c._count.category })),
        };
    }

    // ─── Confirm Bank Transfer Payments ───

    async confirmBankPayment(paymentId: string, userId: string) {
        const payment = await this.prisma.payment.update({
            where: { id: paymentId },
            data: { status: 'paid', paidAt: new Date(), confirmedById: userId },
        });

        // Update order paid amount
        const allPayments = await this.prisma.payment.findMany({
            where: { orderId: payment.orderId, status: 'paid' },
        });
        const paidTotal = allPayments.reduce((sum, p) => sum + Number(p.amount), 0);

        await this.prisma.order.update({
            where: { id: payment.orderId },
            data: {
                paidAmount: paidTotal,
                status: 'confirmed',
            },
        });

        return payment;
    }

    // ═══════════════════════════════════════════════════════════════
    // MANUFACTURER CATALOG (source = 'manufacturer')
    // ═══════════════════════════════════════════════════════════════

    async listManufacturerItems(filters?: { category?: string; search?: string; isVerified?: string }) {
        const where: any = { source: 'manufacturer' };

        if (filters?.category) where.category = filters.category;
        if (filters?.isVerified !== undefined && filters.isVerified !== '') {
            where.isVerified = filters.isVerified === 'true';
        }
        if (filters?.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
                { manufacturerRef: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.manufacturerCatalog.findMany({
            where,
            include: { manufacturer: { select: { id: true, companyName: true, qualityTier: true, isVerified: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getManufacturerItemById(id: string) {
        return this.prisma.manufacturerCatalog.findUnique({
            where: { id },
            include: { manufacturer: { select: { id: true, companyName: true, qualityTier: true, isVerified: true } } },
        });
    }

    async createManufacturerItem(data: {
        name: string;
        description?: string;
        category: string;
        primaryMetal?: string;
        stoneTypes?: string[];
        baseCostMin?: number;
        baseCostMax?: number;
        moq?: number;
        leadTimeDays?: number;
        imageUrl?: string;
        qualityTier?: string;
        manufacturerRef?: string;
        manufacturerId?: string;
    }) {
        return this.prisma.manufacturerCatalog.create({
            data: {
                source: 'manufacturer',
                name: data.name,
                description: data.description,
                category: data.category,
                primaryMetal: data.primaryMetal,
                stoneTypes: data.stoneTypes || [],
                baseCostMin: data.baseCostMin,
                baseCostMax: data.baseCostMax,
                moq: data.moq || 50,
                leadTimeDays: data.leadTimeDays,
                imageUrl: data.imageUrl,
                qualityTier: data.qualityTier || 'standard',
                manufacturerRef: data.manufacturerRef,
                manufacturerId: data.manufacturerId || null,
            },
        });
    }

    async updateManufacturerItem(id: string, data: Record<string, unknown>) {
        const updateData: any = {};
        const fields = [
            'name', 'description', 'category', 'primaryMetal', 'imageUrl',
            'qualityTier', 'manufacturerRef', 'manufacturerId',
        ];
        for (const field of fields) {
            if (data[field] !== undefined) updateData[field] = data[field];
        }
        if (Array.isArray(data.stoneTypes)) updateData.stoneTypes = data.stoneTypes;
        if (data.baseCostMin !== undefined) updateData.baseCostMin = data.baseCostMin === null ? null : Number(data.baseCostMin);
        if (data.baseCostMax !== undefined) updateData.baseCostMax = data.baseCostMax === null ? null : Number(data.baseCostMax);
        if (data.moq !== undefined) updateData.moq = Number(data.moq);
        if (data.leadTimeDays !== undefined) updateData.leadTimeDays = data.leadTimeDays === null ? null : Number(data.leadTimeDays);
        if (data.isVerified !== undefined) updateData.isVerified = Boolean(data.isVerified);

        return this.prisma.manufacturerCatalog.update({
            where: { id },
            data: updateData,
        });
    }

    async deleteManufacturerItem(id: string) {
        return this.prisma.manufacturerCatalog.update({
            where: { id },
            data: { isVerified: false },
        });
    }

    async getManufacturerStats() {
        const [total, verified, unverified, categories] = await Promise.all([
            this.prisma.manufacturerCatalog.count({ where: { source: 'manufacturer' } }),
            this.prisma.manufacturerCatalog.count({ where: { source: 'manufacturer', isVerified: true } }),
            this.prisma.manufacturerCatalog.count({ where: { source: 'manufacturer', isVerified: false } }),
            this.prisma.manufacturerCatalog.groupBy({
                by: ['category'],
                _count: { category: true },
                where: { source: 'manufacturer', isVerified: true },
            }),
        ]);

        return {
            total, verified, unverified,
            categories: categories.map((c) => ({ name: c.category, count: c._count.category })),
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // ALIBABA CATALOG (source = 'alibaba')
    // ═══════════════════════════════════════════════════════════════

    async listAlibabaItems(filters?: { category?: string; search?: string; isVerified?: string }) {
        const where: any = { source: 'alibaba' };

        if (filters?.category) where.category = filters.category;
        if (filters?.isVerified !== undefined && filters.isVerified !== '') {
            where.isVerified = filters.isVerified === 'true';
        }
        if (filters?.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
                { manufacturerRef: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.manufacturerCatalog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }

    async getAlibabaItemById(id: string) {
        return this.prisma.manufacturerCatalog.findUnique({ where: { id } });
    }

    async createAlibabaItem(data: {
        name: string;
        description?: string;
        category: string;
        primaryMetal?: string;
        stoneTypes?: string[];
        baseCostMin?: number;
        baseCostMax?: number;
        moq?: number;
        leadTimeDays?: number;
        imageUrl?: string;
        qualityTier?: string;
        manufacturerRef?: string;
    }) {
        return this.prisma.manufacturerCatalog.create({
            data: {
                source: 'alibaba',
                name: data.name,
                description: data.description,
                category: data.category,
                primaryMetal: data.primaryMetal,
                stoneTypes: data.stoneTypes || [],
                baseCostMin: data.baseCostMin,
                baseCostMax: data.baseCostMax,
                moq: data.moq || 50,
                leadTimeDays: data.leadTimeDays,
                imageUrl: data.imageUrl,
                qualityTier: data.qualityTier || 'standard',
                manufacturerRef: data.manufacturerRef,
            },
        });
    }

    async updateAlibabaItem(id: string, data: Record<string, unknown>) {
        return this.updateManufacturerItem(id, data); // Same fields
    }

    async deleteAlibabaItem(id: string) {
        return this.prisma.manufacturerCatalog.update({
            where: { id },
            data: { isVerified: false },
        });
    }

    async getAlibabaStats() {
        const [total, verified, unverified, categories] = await Promise.all([
            this.prisma.manufacturerCatalog.count({ where: { source: 'alibaba' } }),
            this.prisma.manufacturerCatalog.count({ where: { source: 'alibaba', isVerified: true } }),
            this.prisma.manufacturerCatalog.count({ where: { source: 'alibaba', isVerified: false } }),
            this.prisma.manufacturerCatalog.groupBy({
                by: ['category'],
                _count: { category: true },
                where: { source: 'alibaba', isVerified: true },
            }),
        ]);

        return {
            total, verified, unverified,
            categories: categories.map((c) => ({ name: c.category, count: c._count.category })),
        };
    }

    // ─── Combined Stats Across All Sources ───

    async getAllProductStats() {
        const [inventoryStats, manufacturerStats, alibabaStats] = await Promise.all([
            this.getInventoryStats(),
            this.getManufacturerStats(),
            this.getAlibabaStats(),
        ]);

        return {
            inventory: inventoryStats,
            manufacturer: manufacturerStats,
            alibaba: alibabaStats,
            grandTotal: inventoryStats.total + manufacturerStats.total + alibabaStats.total,
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // MANUFACTURER PROFILES
    // ═══════════════════════════════════════════════════════════════

    async listManufacturers(filters: {
        search?: string;
        category?: string;
        isActive?: string;
        isVerified?: string;
    }) {
        const where: any = {};

        if (filters.search) {
            where.OR = [
                { companyName: { contains: filters.search, mode: 'insensitive' } },
                { contactPerson: { contains: filters.search, mode: 'insensitive' } },
                { email: { contains: filters.search, mode: 'insensitive' } },
                { city: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        if (filters.category) {
            where.categories = { has: filters.category };
        }

        if (filters.isActive !== undefined && filters.isActive !== '') {
            where.isActive = filters.isActive === 'true';
        }

        if (filters.isVerified !== undefined && filters.isVerified !== '') {
            where.isVerified = filters.isVerified === 'true';
        }

        return this.prisma.manufacturer.findMany({
            where,
            include: {
                _count: { select: { products: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getManufacturersStats() {
        const [total, active, verified, byCategory] = await Promise.all([
            this.prisma.manufacturer.count(),
            this.prisma.manufacturer.count({ where: { isActive: true } }),
            this.prisma.manufacturer.count({ where: { isVerified: true } }),
            this.prisma.manufacturer.findMany({
                where: { isActive: true },
                select: { categories: true },
            }),
        ]);

        // Aggregate categories
        const categoryCount: Record<string, number> = {};
        for (const m of byCategory) {
            for (const cat of m.categories) {
                categoryCount[cat] = (categoryCount[cat] || 0) + 1;
            }
        }

        return {
            total,
            active,
            verified,
            inactive: total - active,
            categories: Object.entries(categoryCount).map(([name, count]) => ({ name, count })),
        };
    }

    async getManufacturerById(id: string) {
        return this.prisma.manufacturer.findUniqueOrThrow({
            where: { id },
            include: {
                products: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
                _count: { select: { products: true } },
            },
        });
    }

    async createManufacturer(data: {
        companyName: string;
        contactPerson?: string;
        email?: string;
        phone?: string;
        address?: string;
        city?: string;
        country?: string;
        website?: string;
        description?: string;
        categories?: string[];
        specializations?: string[];
        qualityTier?: string;
        minOrderValue?: number;
        avgLeadTimeDays?: number;
        logoUrl?: string;
        notes?: string;
    }) {
        return this.prisma.manufacturer.create({
            data: {
                companyName: data.companyName,
                contactPerson: data.contactPerson,
                email: data.email,
                phone: data.phone,
                address: data.address,
                city: data.city,
                country: data.country,
                website: data.website,
                description: data.description,
                categories: data.categories || [],
                specializations: data.specializations || [],
                qualityTier: data.qualityTier || 'standard',
                minOrderValue: data.minOrderValue,
                avgLeadTimeDays: data.avgLeadTimeDays,
                logoUrl: data.logoUrl,
                notes: data.notes,
            },
        });
    }

    async updateManufacturer(id: string, data: Record<string, unknown>) {
        const { id: _, createdAt, updatedAt, products, _count, ...updateData } = data as any;
        return this.prisma.manufacturer.update({
            where: { id },
            data: updateData,
        });
    }

    async deleteManufacturer(id: string) {
        return this.prisma.manufacturer.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async getManufacturerProducts(
        manufacturerId: string,
        filters: { category?: string; search?: string },
    ) {
        const where: any = { manufacturerId };

        if (filters.category) {
            where.category = filters.category;
        }

        if (filters.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } },
            ];
        }

        return this.prisma.manufacturerCatalog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }

    async addManufacturerProduct(manufacturerId: string, data: any) {
        return this.prisma.manufacturerCatalog.create({
            data: {
                manufacturerId,
                source: 'manufacturer',
                name: data.name,
                description: data.description,
                category: data.category,
                primaryMetal: data.primaryMetal,
                stoneTypes: data.stoneTypes || [],
                baseCostMin: data.baseCostMin,
                baseCostMax: data.baseCostMax,
                moq: data.moq || 50,
                leadTimeDays: data.leadTimeDays,
                imageUrl: data.imageUrl,
                qualityTier: data.qualityTier || 'standard',
                isVerified: true,
                stockStatus: data.stockStatus || 'unknown',
            },
        });
    }

    // ─── Stock Check & Status (for quotation review) ───

    async checkProductStock(productId: string, source: string) {
        if (source === 'inventory') {
            const item = await this.prisma.inventorySku.findUnique({
                where: { id: productId },
                select: {
                    id: true,
                    name: true,
                    availableQuantity: true,
                    isActive: true,
                    baseCost: true,
                    leadTimeDays: true,
                },
            });
            return {
                ...item,
                stockStatus: item
                    ? item.availableQuantity > 10
                        ? 'in_stock'
                        : item.availableQuantity > 0
                            ? 'low_stock'
                            : 'out_of_stock'
                    : 'not_found',
            };
        }

        const item = await this.prisma.manufacturerCatalog.findUnique({
            where: { id: productId },
            select: {
                id: true,
                name: true,
                stockStatus: true,
                lastStockCheck: true,
                baseCostMin: true,
                baseCostMax: true,
                moq: true,
                leadTimeDays: true,
                manufacturer: {
                    select: { companyName: true, phone: true, email: true },
                },
            },
        });

        return item || { stockStatus: 'not_found' };
    }

    async updateProductStockStatus(productId: string, stockStatus: string, notes?: string) {
        return this.prisma.manufacturerCatalog.update({
            where: { id: productId },
            data: {
                stockStatus,
                lastStockCheck: new Date(),
            },
        });
    }
}
