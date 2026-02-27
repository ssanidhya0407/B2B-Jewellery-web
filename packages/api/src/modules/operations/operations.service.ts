import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OperationsService {
    constructor(private readonly prisma: PrismaService) { }

    private asDecimal(v?: number | string | null) {
        return new Prisma.Decimal(Number(v || 0));
    }

    private isBusinessDay(d: Date) {
        const day = d.getDay();
        return day >= 1 && day <= 5;
    }

    private alignToBusinessWindow(input: Date): Date {
        const d = new Date(input);
        while (!this.isBusinessDay(d)) d.setDate(d.getDate() + 1);
        const start = new Date(d);
        start.setHours(9, 30, 0, 0);
        const end = new Date(d);
        end.setHours(18, 30, 0, 0);
        if (d < start) return start;
        if (d >= end) {
            const next = new Date(d);
            next.setDate(next.getDate() + 1);
            return this.alignToBusinessWindow(next);
        }
        return d;
    }

    private addBusinessHours(input: Date, hours: number): Date {
        let d = this.alignToBusinessWindow(input);
        let remaining = Math.round(hours * 60);
        while (remaining > 0) {
            d = this.alignToBusinessWindow(d);
            const end = new Date(d);
            end.setHours(18, 30, 0, 0);
            const available = Math.max(0, Math.floor((end.getTime() - d.getTime()) / 60000));
            if (available <= 0) {
                d.setDate(d.getDate() + 1);
                d.setHours(9, 30, 0, 0);
                continue;
            }
            const step = Math.min(available, remaining);
            d = new Date(d.getTime() + step * 60000);
            remaining -= step;
            if (remaining > 0) {
                d.setDate(d.getDate() + 1);
                d.setHours(9, 30, 0, 0);
            }
        }
        return d;
    }

    private async createAndSendAutoInitialQuote(cartId: string, salesPersonId: string) {
        const cart = await this.prisma.intendedCart.findUnique({
            where: { id: cartId },
            include: {
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
            },
        });
        if (!cart || cart.items.length === 0) return null;

        const existing = await this.prisma.quotation.findFirst({
            where: { cartId, status: { in: ['draft', 'sent', 'negotiating', 'accepted'] } },
            orderBy: { createdAt: 'desc' },
        });
        if (existing) return existing;

        const year = new Date().getFullYear();
        const prefix = `QT-${year}-`;
        const lastQuotation = await this.prisma.quotation.findFirst({
            where: { quotationNumber: { startsWith: prefix } },
            orderBy: { quotationNumber: 'desc' },
            select: { quotationNumber: true },
        });
        const nextSeq = lastQuotation?.quotationNumber
            ? parseInt(lastQuotation.quotationNumber.replace(prefix, ''), 10) + 1
            : 1;
        const quotationNumber = `${prefix}${String(nextSeq).padStart(4, '0')}`;

        const quoteItems = cart.items.map((item) => {
            const rec = item.recommendationItem;
            const inv = rec?.inventorySku;
            const mf = rec?.manufacturerItem;
            const estimatedUnit =
                Number(rec?.displayPriceMin || 0)
                || Number(inv?.baseCost || 0)
                || Number(mf?.baseCostMin || 0)
                || 1;
            const finalUnit = Number((estimatedUnit * 1.12).toFixed(2));
            const qty = Number(item.quantity || 1);
            return {
                cartItemId: item.id,
                quantity: qty,
                finalUnitPrice: this.asDecimal(finalUnit),
                lineTotal: this.asDecimal(finalUnit * qty),
            };
        });
        const quotedTotal = quoteItems.reduce((sum, item) => sum + Number(item.lineTotal), 0);
        const now = new Date();
        const expiresAt = this.addBusinessHours(now, 18);
        const reminderAt = this.addBusinessHours(now, 15);

        const created = await this.prisma.quotation.create({
            data: {
                quotationNumber,
                cartId,
                createdById: salesPersonId,
                quotedTotal: this.asDecimal(quotedTotal),
                status: 'sent',
                sentAt: now,
                expiresAt,
                validUntil: expiresAt,
                terms: `[System] Auto initial quote (12% markup)\n[System] Reminder At: ${reminderAt.toISOString()}`,
                items: { create: quoteItems },
            },
        });
        await this.prisma.intendedCart.update({
            where: { id: cartId },
            data: { status: 'quoted' },
        });
        return created;
    }

    async getDashboard() {
        const [submitted, underReview, orders, suppliers] = await Promise.all([
            this.prisma.intendedCart.count({ where: { status: 'submitted' } }),
            this.prisma.intendedCart.count({ where: { status: 'under_review' } }),
            this.prisma.order.count(),
            this.prisma.supplier.count({ where: { isActive: true } }),
        ]);

        return {
            requests: { submitted, underReview },
            orders,
            suppliers,
        };
    }

    async getHealth() {
        const [users, carts, quotations, orders] = await Promise.all([
            this.prisma.user.count(),
            this.prisma.intendedCart.count(),
            this.prisma.quotation.count(),
            this.prisma.order.count(),
        ]);
        return { ok: true, users, carts, quotations, orders, checkedAt: new Date().toISOString() };
    }

    async getMarkups() {
        return this.prisma.marginConfiguration.findMany({ orderBy: { createdAt: 'desc' } });
    }

    async upsertMarkup(userId: string, data: { category?: string; sourceType?: string; markupPercent: number }) {
        const existing = await this.prisma.marginConfiguration.findFirst({
            where: {
                category: data.category || null,
                sourceType: data.sourceType || null,
                isActive: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (existing) {
            return this.prisma.marginConfiguration.update({
                where: { id: existing.id },
                data: {
                    marginPercentage: this.asDecimal(data.markupPercent),
                    createdById: userId,
                },
            });
        }

        return this.prisma.marginConfiguration.create({
            data: {
                category: data.category || null,
                sourceType: data.sourceType || null,
                marginPercentage: this.asDecimal(data.markupPercent),
                createdById: userId,
                isActive: true,
            },
        });
    }

    async getScraperConfig() {
        const cfg = await this.prisma.systemConfig.findUnique({ where: { key: 'scraper_config' } });
        return { config: cfg?.value || {} };
    }

    async updateScraperConfig(userId: string, config: unknown) {
        return this.prisma.systemConfig.upsert({
            where: { key: 'scraper_config' },
            create: { key: 'scraper_config', value: (config || {}) as Prisma.InputJsonValue, updatedBy: userId },
            update: { value: (config || {}) as Prisma.InputJsonValue, updatedBy: userId },
        });
    }

    async listSuppliers() {
        return this.prisma.supplier.findMany({ orderBy: { updatedAt: 'desc' } });
    }

    async createSupplier(data: Record<string, unknown>) {
        return this.prisma.supplier.create({
            data: {
                name: String(data.name || 'Supplier'),
                type: String(data.type || 'brand'),
                contactEmail: (data.contactEmail as string) || null,
                contactPhone: (data.contactPhone as string) || null,
                website: (data.website as string) || null,
                apiEndpoint: (data.apiEndpoint as string) || null,
                notes: (data.notes as string) || null,
                isActive: data.isActive !== false,
            },
        });
    }

    async updateSupplier(id: string, data: Record<string, unknown>) {
        return this.prisma.supplier.update({
            where: { id },
            data: {
                name: data.name != null ? String(data.name) : undefined,
                type: data.type != null ? String(data.type) : undefined,
                contactEmail: data.contactEmail != null ? String(data.contactEmail) : undefined,
                contactPhone: data.contactPhone != null ? String(data.contactPhone) : undefined,
                website: data.website != null ? String(data.website) : undefined,
                apiEndpoint: data.apiEndpoint != null ? String(data.apiEndpoint) : undefined,
                notes: data.notes != null ? String(data.notes) : undefined,
                isActive: data.isActive != null ? Boolean(data.isActive) : undefined,
            },
        });
    }

    async getPendingProducts() {
        const [inventory, catalog] = await Promise.all([
            this.prisma.inventorySku.findMany({ where: { isActive: false }, orderBy: { updatedAt: 'desc' }, take: 50 }),
            this.prisma.manufacturerCatalog.findMany({ where: { isVerified: false }, orderBy: { updatedAt: 'desc' }, take: 50 }),
        ]);
        return { inventory, catalog };
    }

    async approveProduct(type: 'inventory' | 'manufacturer', id: string) {
        if (type === 'inventory') {
            return this.prisma.inventorySku.update({ where: { id }, data: { isActive: true } });
        }
        return this.prisma.manufacturerCatalog.update({ where: { id }, data: { isVerified: true } });
    }

    async rejectProduct(type: 'inventory' | 'manufacturer', id: string) {
        if (type === 'inventory') {
            return this.prisma.inventorySku.update({ where: { id }, data: { isActive: false } });
        }
        return this.prisma.manufacturerCatalog.update({ where: { id }, data: { isVerified: false } });
    }

    async getOrders(status?: string) {
        return this.prisma.order.findMany({
            where: status ? { status: status as any } : undefined,
            include: {
                buyer: true,
                quotation: { include: { cart: true } },
                items: true,
                payments: true,
                shipments: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async updateOrderStatus(orderId: string, status: string) {
        return this.prisma.order.update({ where: { id: orderId }, data: { status: status as any } });
    }

    async approveFinalCheck(orderId: string, userId: string) {
        return this.prisma.order.update({
            where: { id: orderId },
            data: {
                opsFinalCheckStatus: 'approved',
                opsFinalCheckedAt: new Date(),
                opsFinalCheckedById: userId,
                opsFinalCheckReason: null,
            },
        });
    }

    async rejectFinalCheck(orderId: string, userId: string, reason?: string) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { quotation: true } });
        if (!order) throw new NotFoundException('Order not found');

        await this.prisma.$transaction(async (tx) => {
            await tx.order.update({
                where: { id: order.id },
                data: {
                    opsFinalCheckStatus: 'rejected',
                    opsFinalCheckedAt: new Date(),
                    opsFinalCheckedById: userId,
                    opsFinalCheckReason: reason || null,
                    status: 'cancelled',
                },
            });

            await tx.quotation.update({ where: { id: order.quotationId }, data: { status: 'rejected' } });
            await tx.intendedCart.update({ where: { id: order.quotation.cartId }, data: { status: 'closed' } });
        });

        return { success: true };
    }

    async createProcurement(data: Record<string, unknown>) {
        return this.prisma.procurementRecord.create({
            data: {
                orderId: String(data.orderId || ''),
                supplierId: (data.supplierId as string) || null,
                source: String(data.source || 'manufacturer'),
                status: String(data.status || 'pending'),
                poNumber: (data.poNumber as string) || null,
                notes: (data.notes as string) || null,
            },
        });
    }

    async createShipment(data: Record<string, unknown>) {
        return this.prisma.shipment.create({
            data: {
                orderId: String(data.orderId || ''),
                trackingNumber: (data.trackingNumber as string) || null,
                carrier: (data.carrier as string) || null,
                status: String(data.status || 'preparing'),
                notes: (data.notes as string) || null,
            },
        });
    }

    async updateShipmentStatus(id: string, status: string, trackingNumber?: string) {
        return this.prisma.shipment.update({ where: { id }, data: { status, trackingNumber: trackingNumber ?? undefined } });
    }

    async confirmBankPayment(paymentId: string, userId: string) {
        const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment) throw new NotFoundException('Payment not found');

        const paidAt = new Date();
        const updatedPayment = await this.prisma.payment.update({
            where: { id: paymentId },
            data: {
                status: 'paid',
                paidAt,
                confirmedById: userId,
            },
        });

        await this.prisma.order.update({
            where: { id: payment.orderId },
            data: {
                paidAmount: { increment: payment.amount },
                paymentConfirmedAt: paidAt,
                paymentConfirmedById: userId,
                paymentConfirmationSource: 'bank_transfer',
            },
        });

        return updatedPayment;
    }

    async listInventory(filters: { category?: string; search?: string; isActive?: string }) {
        return this.prisma.inventorySku.findMany({
            where: {
                category: filters.category || undefined,
                isActive: filters.isActive === '' || filters.isActive == null ? undefined : filters.isActive === 'true',
                OR: filters.search
                    ? [
                        { name: { contains: filters.search, mode: 'insensitive' } },
                        { skuCode: { contains: filters.search, mode: 'insensitive' } },
                    ]
                    : undefined,
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async inventoryStats() {
        const [total, active, categoriesRows] = await Promise.all([
            this.prisma.inventorySku.count(),
            this.prisma.inventorySku.count({ where: { isActive: true } }),
            this.prisma.inventorySku.groupBy({ by: ['category'], _count: { _all: true } }),
        ]);
        return {
            total,
            active,
            inactive: Math.max(total - active, 0),
            categories: categoriesRows.map((r) => ({ name: r.category, count: r._count._all })),
        };
    }

    async getInventoryItem(id: string) {
        return this.prisma.inventorySku.findUnique({ where: { id } });
    }

    async createInventory(data: Record<string, unknown>) {
        return this.prisma.inventorySku.create({
            data: {
                skuCode: String(data.skuCode || `SKU-${Date.now()}`),
                name: String(data.name || 'Unnamed SKU'),
                description: (data.description as string) || null,
                category: String(data.category || 'other'),
                primaryMetal: (data.primaryMetal as string) || null,
                stoneTypes: Array.isArray(data.stoneTypes) ? data.stoneTypes.map(String) : [],
                stonePresence: (data.stonePresence as string) || null,
                primaryShape: (data.primaryShape as string) || null,
                style: (data.style as string) || null,
                complexity: (data.complexity as string) || null,
                baseCost: this.asDecimal(data.baseCost as number),
                moq: Number(data.moq || 1),
                leadTimeDays: data.leadTimeDays != null ? Number(data.leadTimeDays) : null,
                availableQuantity: Number(data.availableQuantity || 0),
                imageUrl: String(data.imageUrl || '/product-images/other-01.jpg'),
                isActive: data.isActive !== false,
            },
        });
    }

    async updateInventory(id: string, data: Record<string, unknown>) {
        return this.prisma.inventorySku.update({
            where: { id },
            data: {
                skuCode: data.skuCode != null ? String(data.skuCode) : undefined,
                name: data.name != null ? String(data.name) : undefined,
                description: data.description != null ? String(data.description) : undefined,
                category: data.category != null ? String(data.category) : undefined,
                primaryMetal: data.primaryMetal != null ? String(data.primaryMetal) : undefined,
                stoneTypes: Array.isArray(data.stoneTypes) ? data.stoneTypes.map(String) : undefined,
                stonePresence: data.stonePresence != null ? String(data.stonePresence) : undefined,
                primaryShape: data.primaryShape != null ? String(data.primaryShape) : undefined,
                style: data.style != null ? String(data.style) : undefined,
                complexity: data.complexity != null ? String(data.complexity) : undefined,
                baseCost: data.baseCost != null ? this.asDecimal(data.baseCost as number) : undefined,
                moq: data.moq != null ? Number(data.moq) : undefined,
                leadTimeDays: data.leadTimeDays != null ? Number(data.leadTimeDays) : undefined,
                availableQuantity: data.availableQuantity != null ? Number(data.availableQuantity) : undefined,
                imageUrl: data.imageUrl != null ? String(data.imageUrl) : undefined,
                isActive: data.isActive != null ? Boolean(data.isActive) : undefined,
            },
        });
    }

    async deleteInventory(id: string) {
        return this.prisma.inventorySku.delete({ where: { id } });
    }

    async listManufacturerCatalog(source: 'manufacturer' | 'alibaba', filters: { category?: string; search?: string; isVerified?: string }) {
        return this.prisma.manufacturerCatalog.findMany({
            where: {
                source,
                category: filters.category || undefined,
                isVerified: filters.isVerified === '' || filters.isVerified == null ? undefined : filters.isVerified === 'true',
                OR: filters.search
                    ? [
                        { name: { contains: filters.search, mode: 'insensitive' } },
                        { manufacturerRef: { contains: filters.search, mode: 'insensitive' } },
                    ]
                    : undefined,
            },
            include: { manufacturer: true },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async manufacturerCatalogStats(source: 'manufacturer' | 'alibaba') {
        const [total, verified, categoriesRows] = await Promise.all([
            this.prisma.manufacturerCatalog.count({ where: { source } }),
            this.prisma.manufacturerCatalog.count({ where: { source, isVerified: true } }),
            this.prisma.manufacturerCatalog.groupBy({ by: ['category'], where: { source }, _count: { _all: true } }),
        ]);
        return {
            total,
            verified,
            unverified: Math.max(total - verified, 0),
            categories: categoriesRows.map((r) => ({ name: r.category, count: r._count._all })),
        };
    }

    async getCatalogItem(id: string) {
        return this.prisma.manufacturerCatalog.findUnique({ where: { id }, include: { manufacturer: true } });
    }

    async createCatalogItem(source: 'manufacturer' | 'alibaba', data: Record<string, unknown>) {
        return this.prisma.manufacturerCatalog.create({
            data: {
                source,
                manufacturerId: (data.manufacturerId as string) || null,
                manufacturerRef: (data.manufacturerRef as string) || null,
                name: String(data.name || 'Unnamed item'),
                description: (data.description as string) || null,
                category: String(data.category || 'other'),
                primaryMetal: (data.primaryMetal as string) || null,
                stoneTypes: Array.isArray(data.stoneTypes) ? data.stoneTypes.map(String) : [],
                baseCostMin: data.baseCostMin != null ? this.asDecimal(data.baseCostMin as number) : null,
                baseCostMax: data.baseCostMax != null ? this.asDecimal(data.baseCostMax as number) : null,
                moq: Number(data.moq || 1),
                leadTimeDays: data.leadTimeDays != null ? Number(data.leadTimeDays) : null,
                imageUrl: (data.imageUrl as string) || '/product-images/other-01.jpg',
                qualityTier: String(data.qualityTier || 'standard'),
                isVerified: data.isVerified !== false,
            },
            include: { manufacturer: true },
        });
    }

    async updateCatalogItem(id: string, data: Record<string, unknown>) {
        return this.prisma.manufacturerCatalog.update({
            where: { id },
            data: {
                manufacturerId: data.manufacturerId != null ? String(data.manufacturerId) : undefined,
                manufacturerRef: data.manufacturerRef != null ? String(data.manufacturerRef) : undefined,
                name: data.name != null ? String(data.name) : undefined,
                description: data.description != null ? String(data.description) : undefined,
                category: data.category != null ? String(data.category) : undefined,
                primaryMetal: data.primaryMetal != null ? String(data.primaryMetal) : undefined,
                stoneTypes: Array.isArray(data.stoneTypes) ? data.stoneTypes.map(String) : undefined,
                baseCostMin: data.baseCostMin != null ? this.asDecimal(data.baseCostMin as number) : undefined,
                baseCostMax: data.baseCostMax != null ? this.asDecimal(data.baseCostMax as number) : undefined,
                moq: data.moq != null ? Number(data.moq) : undefined,
                leadTimeDays: data.leadTimeDays != null ? Number(data.leadTimeDays) : undefined,
                imageUrl: data.imageUrl != null ? String(data.imageUrl) : undefined,
                qualityTier: data.qualityTier != null ? String(data.qualityTier) : undefined,
                isVerified: data.isVerified != null ? Boolean(data.isVerified) : undefined,
            },
            include: { manufacturer: true },
        });
    }

    async deleteCatalogItem(id: string) {
        return this.prisma.manufacturerCatalog.delete({ where: { id } });
    }

    async getAllProductStats() {
        const [inventory, manufacturer, alibaba] = await Promise.all([
            this.inventoryStats(),
            this.manufacturerCatalogStats('manufacturer'),
            this.manufacturerCatalogStats('alibaba'),
        ]);
        return {
            inventory,
            manufacturer,
            alibaba,
            grandTotal: inventory.total + manufacturer.total + alibaba.total,
        };
    }

    async listManufacturers(filters: { search?: string; category?: string; isActive?: string; isVerified?: string }) {
        return this.prisma.manufacturer.findMany({
            where: {
                isActive: filters.isActive === '' || filters.isActive == null ? undefined : filters.isActive === 'true',
                isVerified: filters.isVerified === '' || filters.isVerified == null ? undefined : filters.isVerified === 'true',
                categories: filters.category ? { has: filters.category } : undefined,
                OR: filters.search
                    ? [
                        { companyName: { contains: filters.search, mode: 'insensitive' } },
                        { contactPerson: { contains: filters.search, mode: 'insensitive' } },
                        { email: { contains: filters.search, mode: 'insensitive' } },
                    ]
                    : undefined,
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async manufacturerStats() {
        const [total, active, verified] = await Promise.all([
            this.prisma.manufacturer.count(),
            this.prisma.manufacturer.count({ where: { isActive: true } }),
            this.prisma.manufacturer.count({ where: { isVerified: true } }),
        ]);
        return { total, active, inactive: total - active, verified, unverified: total - verified };
    }

    async getManufacturer(id: string) {
        return this.prisma.manufacturer.findUnique({ where: { id }, include: { products: true } });
    }

    async createManufacturer(data: Record<string, unknown>) {
        return this.prisma.manufacturer.create({
            data: {
                companyName: String(data.companyName || 'Manufacturer'),
                contactPerson: (data.contactPerson as string) || null,
                email: (data.email as string) || null,
                phone: (data.phone as string) || null,
                address: (data.address as string) || null,
                city: (data.city as string) || null,
                country: (data.country as string) || null,
                website: (data.website as string) || null,
                description: (data.description as string) || null,
                categories: Array.isArray(data.categories) ? data.categories.map(String) : [],
                specializations: Array.isArray(data.specializations) ? data.specializations.map(String) : [],
                qualityTier: String(data.qualityTier || 'standard'),
                minOrderValue: data.minOrderValue != null ? this.asDecimal(data.minOrderValue as number) : null,
                avgLeadTimeDays: data.avgLeadTimeDays != null ? Number(data.avgLeadTimeDays) : null,
                logoUrl: (data.logoUrl as string) || null,
                isVerified: data.isVerified === true,
                isActive: data.isActive !== false,
                notes: (data.notes as string) || null,
            },
        });
    }

    async updateManufacturer(id: string, data: Record<string, unknown>) {
        return this.prisma.manufacturer.update({
            where: { id },
            data: {
                companyName: data.companyName != null ? String(data.companyName) : undefined,
                contactPerson: data.contactPerson != null ? String(data.contactPerson) : undefined,
                email: data.email != null ? String(data.email) : undefined,
                phone: data.phone != null ? String(data.phone) : undefined,
                address: data.address != null ? String(data.address) : undefined,
                city: data.city != null ? String(data.city) : undefined,
                country: data.country != null ? String(data.country) : undefined,
                website: data.website != null ? String(data.website) : undefined,
                description: data.description != null ? String(data.description) : undefined,
                categories: Array.isArray(data.categories) ? data.categories.map(String) : undefined,
                specializations: Array.isArray(data.specializations) ? data.specializations.map(String) : undefined,
                qualityTier: data.qualityTier != null ? String(data.qualityTier) : undefined,
                minOrderValue: data.minOrderValue != null ? this.asDecimal(data.minOrderValue as number) : undefined,
                avgLeadTimeDays: data.avgLeadTimeDays != null ? Number(data.avgLeadTimeDays) : undefined,
                logoUrl: data.logoUrl != null ? String(data.logoUrl) : undefined,
                isVerified: data.isVerified != null ? Boolean(data.isVerified) : undefined,
                isActive: data.isActive != null ? Boolean(data.isActive) : undefined,
                notes: data.notes != null ? String(data.notes) : undefined,
            },
        });
    }

    async deleteManufacturer(id: string) {
        return this.prisma.manufacturer.delete({ where: { id } });
    }

    async getManufacturerProducts(manufacturerId: string, filters: { category?: string; search?: string }) {
        return this.prisma.manufacturerCatalog.findMany({
            where: {
                manufacturerId,
                source: 'manufacturer',
                category: filters.category || undefined,
                OR: filters.search ? [{ name: { contains: filters.search, mode: 'insensitive' } }] : undefined,
            },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async addManufacturerProduct(manufacturerId: string, data: Record<string, unknown>) {
        return this.createCatalogItem('manufacturer', { ...data, manufacturerId });
    }

    async checkProductStock(productId: string, source: string) {
        if (source === 'inventory') {
            const sku = await this.prisma.inventorySku.findUnique({ where: { id: productId } });
            if (!sku) throw new NotFoundException('Product not found');
            const status = sku.availableQuantity > 0 ? 'in_stock' : 'out_of_stock';
            return { productId, source, stockStatus: status, quantity: sku.availableQuantity };
        }
        const item = await this.prisma.manufacturerCatalog.findUnique({ where: { id: productId } });
        if (!item) throw new NotFoundException('Product not found');
        return { productId, source, stockStatus: item.stockStatus || 'unknown' };
    }

    async updateProductStockStatus(productId: string, stockStatus: string, notes?: string) {
        await this.prisma.manufacturerCatalog.update({
            where: { id: productId },
            data: {
                stockStatus,
                lastStockCheck: new Date(),
                description: notes ? undefined : undefined,
            },
        });
        return { success: true };
    }

    async validateCartInventory(cartId: string, userId: string) {
        const cart = await this.prisma.intendedCart.findUnique({
            where: { id: cartId },
            include: { items: { include: { recommendationItem: { include: { inventorySku: true, manufacturerItem: true } } } } },
        });
        if (!cart) throw new NotFoundException('Cart not found');

        await this.prisma.$transaction(async (tx) => {
            for (const item of cart.items) {
                const invQty = item.recommendationItem.inventorySku?.availableQuantity ?? 0;
                const status = invQty >= item.quantity ? 'in_stock' : invQty > 0 ? 'low_stock' : 'out_of_stock';
                await tx.cartItem.update({
                    where: { id: item.id },
                    data: {
                        inventoryStatus: status,
                        availableSource: item.recommendationItem.inventorySku ? 'internal' : 'manufacturer',
                        validatedQuantity: invQty,
                        validatedAt: new Date(),
                        validatedById: userId,
                    },
                });
            }

            await tx.intendedCart.update({
                where: { id: cartId },
                data: {
                    status: 'under_review',
                    validatedAt: new Date(),
                    validatedByOpsId: userId,
                },
            });
        });

        return this.prisma.intendedCart.findUnique({
            where: { id: cartId },
            include: { items: true, validatedByOps: true },
        });
    }

    async forwardToSales(cartId: string, salesPersonId: string) {
        const salesUser = await this.prisma.user.findUnique({ where: { id: salesPersonId } });
        if (!salesUser || salesUser.userType !== 'sales') throw new BadRequestException('Invalid sales person');

        const updated = await this.prisma.intendedCart.update({
            where: { id: cartId },
            data: {
                assignedSalesId: salesPersonId,
                assignedAt: new Date(),
                status: 'under_review',
            },
            include: { assignedSales: true },
        });
        await this.createAndSendAutoInitialQuote(cartId, salesPersonId);
        return updated;
    }

    async getSalesTeam() {
        return this.prisma.user.findMany({
            where: { userType: 'sales', isActive: true },
            select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
            orderBy: { createdAt: 'asc' },
        });
    }

    // ════════════════════════════════════════════════════════════════
    // MODULE 2.1 — Validation Page
    // ════════════════════════════════════════════════════════════════

    async getValidations(filters: {
        status?: string;
        riskFlag?: string;
        page?: number;
        limit?: number;
        search?: string;
    }) {
        const page = Math.max(filters.page || 1, 1);
        const limit = Math.min(Math.max(filters.limit || 20, 1), 100);
        const skip = (page - 1) * limit;

        const where: any = {};
        if (filters.status) where.validationStatus = filters.status;
        if (filters.riskFlag) where.riskFlags = { has: filters.riskFlag };
        if (filters.search) {
            where.OR = [
                { recommendationItem: { inventorySku: { name: { contains: filters.search, mode: 'insensitive' } } } },
                { recommendationItem: { manufacturerItem: { name: { contains: filters.search, mode: 'insensitive' } } } },
            ];
        }

        const [items, total] = await Promise.all([
            this.prisma.cartItem.findMany({
                where,
                include: {
                    cart: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true, companyName: true } } } },
                    recommendationItem: { include: { inventorySku: true, manufacturerItem: true } },
                    validatedBy: { select: { id: true, email: true, firstName: true, lastName: true } },
                },
                orderBy: { addedAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.cartItem.count({ where }),
        ]);

        return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async batchValidate(cartItemIds: string[], userId: string, action: 'approve' | 'reject') {
        if (!cartItemIds?.length) throw new BadRequestException('No items provided');

        const validationStatus = action === 'approve' ? 'approved' : 'rejected';

        return this.prisma.$transaction(async (tx) => {
            const items = await tx.cartItem.findMany({
                where: { id: { in: cartItemIds } },
                include: { recommendationItem: { include: { inventorySku: true, manufacturerItem: true } } },
            });

            for (const item of items) {
                const riskFlags = this.detectRiskFlags(item);
                await tx.cartItem.update({
                    where: { id: item.id },
                    data: {
                        validationStatus: validationStatus,
                        validatedAt: new Date(),
                        validatedById: userId,
                        riskFlags,
                    } as any,
                });

                // Create audit log
                await (tx as any).auditLog.create({
                    data: {
                        entityType: 'cart_item',
                        entityId: item.id,
                        action: `validation_${action}d`,
                        details: { validationStatus, riskFlags } as any,
                        performedBy: userId,
                    },
                });
            }

            return { updated: items.length, status: validationStatus };
        });
    }

    detectRiskFlags(item: any): string[] {
        const flags: string[] = [];

        const sku = item.recommendationItem?.inventorySku;
        const mfg = item.recommendationItem?.manufacturerItem;

        // Stock mismatch
        if (sku) {
            if ((sku.availableQuantity ?? 0) < item.quantity) {
                flags.push('STOCK_MISMATCH');
            }
        }

        // MOQ violation
        const moq = sku?.moq || mfg?.moq || 0;
        if (moq > 0 && item.quantity < moq) {
            flags.push('MOQ_VIOLATION');
        }

        // Lead time risk
        const leadDays = sku?.leadTimeDays || mfg?.leadTimeDays || 0;
        if (leadDays > 30) {
            flags.push('LEAD_TIME_RISK');
        }

        // Pricing mismatch — if validated price deviates >30% from base
        const baseCost = Number(sku?.baseCost || mfg?.baseCostMin || 0);
        if (baseCost > 0 && item.validatedQuantity != null) {
            // Price mismatch detection would need quoted price comparison
            // Flagged if no base cost exists
        }
        if (!baseCost || baseCost <= 0) {
            flags.push('NO_BASE_COST');
        }

        return flags;
    }

    async getAuditTrail(entityType: string, entityId: string) {
        return (this.prisma as any).auditLog.findMany({
            where: { entityType, entityId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }

    async createAuditLog(data: { entityType: string; entityId: string; action: string; details?: any; performedBy: string }) {
        return (this.prisma as any).auditLog.create({
            data: {
                entityType: data.entityType,
                entityId: data.entityId,
                action: data.action,
                details: data.details || null,
                performedBy: data.performedBy,
            },
        });
    }

    // ════════════════════════════════════════════════════════════════
    // MODULE 2.2 — Enhanced Dashboard
    // ════════════════════════════════════════════════════════════════

    async getEnhancedDashboard() {
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [
            totalOrders,
            pendingOrders,
            confirmedOrders,
            shippedOrders,
            deliveredOrders,
            cancelledOrders,
            newRequests,
            underReviewRequests,
            quotedRequests,
            totalInventory,
            pendingApproval,
            recentValidations,
            totalRevenue,
            slaBreaches,
        ] = await Promise.all([
            this.prisma.order.count(),
            this.prisma.order.count({ where: { status: 'pending_payment' } }),
            this.prisma.order.count({ where: { status: 'confirmed' } }),
            this.prisma.order.count({ where: { status: 'shipped' } }),
            this.prisma.order.count({ where: { status: 'delivered' } }),
            this.prisma.order.count({ where: { status: 'cancelled' } }),
            this.prisma.intendedCart.count({ where: { status: 'submitted' } }),
            this.prisma.intendedCart.count({ where: { status: 'under_review' } }),
            this.prisma.intendedCart.count({ where: { status: 'quoted' } }),
            this.prisma.inventorySku.count({ where: { isActive: true } }),
            this.prisma.inventorySku.count({ where: { isActive: false } }),
            // Recent validations for turnaround calculation
            this.prisma.cartItem.findMany({
                where: { validatedAt: { gte: sevenDaysAgo } },
                select: { addedAt: true, validatedAt: true },
            }),
            // Revenue pipeline
            this.prisma.order.aggregate({
                _sum: { totalAmount: true },
                where: { status: { not: 'cancelled' } },
            }),
            // SLA breaches: requests older than 48h still in submitted status
            this.prisma.intendedCart.count({
                where: {
                    status: 'submitted',
                    submittedAt: { lt: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
                },
            }),
        ]);

        // Calculate avg turnaround (hours)
        let avgTurnaroundHours = 0;
        if (recentValidations.length > 0) {
            const totalHours = recentValidations.reduce((sum, v) => {
                if (!v.validatedAt) return sum;
                return sum + (v.validatedAt.getTime() - v.addedAt.getTime()) / (1000 * 60 * 60);
            }, 0);
            avgTurnaroundHours = Math.round((totalHours / recentValidations.length) * 10) / 10;
        }

        // Validation trend (last 7 days)
        const validationTrend: { date: string; count: number }[] = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(now);
            dayStart.setDate(dayStart.getDate() - i);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            const count = recentValidations.filter(
                (v) => v.validatedAt && v.validatedAt >= dayStart && v.validatedAt <= dayEnd,
            ).length;

            validationTrend.push({
                date: dayStart.toISOString().split('T')[0],
                count,
            });
        }

        return {
            kpis: {
                totalOrders,
                revenuePipeline: Number(totalRevenue._sum.totalAmount || 0),
                avgTurnaroundHours,
                slaBreaches,
                pendingValidations: newRequests,
            },
            orderPipeline: {
                pending_payment: pendingOrders,
                confirmed: confirmedOrders,
                shipped: shippedOrders,
                delivered: deliveredOrders,
                cancelled: cancelledOrders,
            },
            requests: {
                submitted: newRequests,
                under_review: underReviewRequests,
                quoted: quotedRequests,
            },
            inventory: {
                total: totalInventory,
                pendingApproval,
            },
            validationTrend,
            lastUpdated: now.toISOString(),
        };
    }

    // ════════════════════════════════════════════════════════════════
    // MODULE 2.3 — Validation Reports
    // ════════════════════════════════════════════════════════════════

    async generateReport(filters: {
        dateFrom?: string;
        dateTo?: string;
        status?: string;
        category?: string;
        sourceType?: string;
    }) {
        const where: any = {};

        if (filters.dateFrom || filters.dateTo) {
            where.validatedAt = {};
            if (filters.dateFrom) where.validatedAt.gte = new Date(filters.dateFrom);
            if (filters.dateTo) where.validatedAt.lte = new Date(filters.dateTo);
        }
        if (filters.status) where.validationStatus = filters.status;
        if (filters.category) {
            where.recommendationItem = { inventorySku: { category: filters.category } };
        }
        if (filters.sourceType) where.availableSource = filters.sourceType;

        const [items, totals, statusBreakdown] = await Promise.all([
            this.prisma.cartItem.findMany({
                where,
                include: {
                    cart: { include: { user: { select: { email: true, companyName: true } } } },
                    recommendationItem: { include: { inventorySku: true, manufacturerItem: true } },
                    validatedBy: { select: { email: true, firstName: true, lastName: true } },
                },
                orderBy: { validatedAt: 'desc' },
                take: 500,
            }),
            this.prisma.cartItem.aggregate({
                where,
                _count: { _all: true },
                _avg: { validatedQuantity: true },
            }),
            (this.prisma.cartItem.groupBy as any)({
                by: ['validationStatus'],
                where: { ...where, validatedAt: where.validatedAt || { not: null } },
                _count: { _all: true },
            }),
        ]);

        // Calculate avg turnaround
        const validated = items.filter((i) => i.validatedAt);
        let avgTurnaroundHours = 0;
        if (validated.length > 0) {
            const totalMs = validated.reduce(
                (sum, v) => sum + (v.validatedAt!.getTime() - v.addedAt.getTime()),
                0,
            );
            avgTurnaroundHours = Math.round((totalMs / validated.length / (1000 * 60 * 60)) * 10) / 10;
        }

        return {
            items,
            summary: {
                totalItems: totals._count._all,
                avgValidatedQuantity: Math.round(totals._avg.validatedQuantity || 0),
                avgTurnaroundHours,
                statusBreakdown: (statusBreakdown as any[]).map((s: any) => ({
                    status: s.validationStatus,
                    count: s._count?._all ?? 0,
                })),
            },
        };
    }

    async exportReportCsv(filters: { dateFrom?: string; dateTo?: string; status?: string; category?: string; sourceType?: string }) {
        const report = await this.generateReport(filters);

        const headers = ['Item ID', 'Product', 'Category', 'Source', 'Qty', 'Available Qty', 'Status', 'Risk Flags', 'Validated By', 'Validated At', 'Buyer'];
        const rows = report.items.map((item) => [
            item.id,
            item.recommendationItem?.inventorySku?.name || item.recommendationItem?.manufacturerItem?.name || 'N/A',
            item.recommendationItem?.inventorySku?.category || item.recommendationItem?.manufacturerItem?.category || '',
            item.availableSource || '',
            item.quantity,
            item.validatedQuantity ?? '',
            (item as any).validationStatus,
            ((item as any).riskFlags || []).join('; '),
            item.validatedBy ? `${item.validatedBy.firstName || ''} ${item.validatedBy.lastName || ''}`.trim() : '',
            item.validatedAt?.toISOString() || '',
            item.cart?.user?.companyName || item.cart?.user?.email || '',
        ]);

        const csvContent = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
        return { csv: csvContent, filename: `validation-report-${new Date().toISOString().split('T')[0]}.csv` };
    }

    // Report Templates CRUD
    async listReportTemplates(userId: string) {
        return (this.prisma as any).reportTemplate.findMany({
            where: { OR: [{ createdBy: userId }, { isDefault: true }] },
            orderBy: { updatedAt: 'desc' },
        });
    }

    async saveReportTemplate(userId: string, data: { name: string; filters: any; isDefault?: boolean }) {
        return (this.prisma as any).reportTemplate.create({
            data: {
                name: data.name,
                filters: data.filters || {},
                createdBy: userId,
                isDefault: data.isDefault || false,
            },
        });
    }

    async deleteReportTemplate(id: string, userId: string) {
        const template = await (this.prisma as any).reportTemplate.findUnique({ where: { id } });
        if (!template || template.createdBy !== userId) throw new NotFoundException('Template not found');
        return (this.prisma as any).reportTemplate.delete({ where: { id } });
    }

    // ════════════════════════════════════════════════════════════════
    // MODULE 2.4 — Sales Forwarding
    // ════════════════════════════════════════════════════════════════

    async autoAssignToSales(cartId: string, assignedByUserId?: string) {
        // Get all active sales reps
        const salesReps = await this.prisma.user.findMany({
            where: { userType: 'sales', isActive: true },
            select: { id: true, email: true, firstName: true, lastName: true },
        });

        if (salesReps.length === 0) throw new BadRequestException('No active sales reps available');

        // Count open assignments per rep (carts not yet quoted/closed)
        const workloads = await Promise.all(
            salesReps.map(async (rep) => {
                const count = await this.prisma.intendedCart.count({
                    where: {
                        assignedSalesId: rep.id,
                        status: { in: ['submitted', 'under_review'] },
                    },
                });
                return { rep, openAssignments: count };
            }),
        );

        // Pick rep with lowest workload (round-robin + load balance)
        workloads.sort((a, b) => a.openAssignments - b.openAssignments);
        const chosen = workloads[0];

        // Assign
        const updated = await this.prisma.intendedCart.update({
            where: { id: cartId },
            data: {
                assignedSalesId: chosen.rep.id,
                assignedAt: new Date(),
                status: 'under_review',
            },
            include: { assignedSales: true },
        });

        // Record assignment
        await (this.prisma as any).salesAssignment.create({
            data: {
                salesPersonId: chosen.rep.id,
                cartId,
                assignedBy: assignedByUserId || null,
            },
        });

        // Audit log
        await this.createAuditLog({
            entityType: 'cart',
            entityId: cartId,
            action: 'auto_assigned',
            details: { salesPersonId: chosen.rep.id, workload: chosen.openAssignments },
            performedBy: assignedByUserId || chosen.rep.id,
        });

        await this.createAndSendAutoInitialQuote(cartId, chosen.rep.id);

        return updated;
    }

    async getSalesPerformance() {
        const salesReps = await this.prisma.user.findMany({
            where: { userType: 'sales', isActive: true },
            select: { id: true, email: true, firstName: true, lastName: true },
        });

        const metrics = await Promise.all(
            salesReps.map(async (rep) => {
                const [assignedCount, quotedCount, convertedCount, commissions] = await Promise.all([
                    this.prisma.intendedCart.count({ where: { assignedSalesId: rep.id } }),
                    this.prisma.quotation.count({ where: { createdById: rep.id } }),
                    this.prisma.order.count({ where: { salesPersonId: rep.id } }),
                    this.prisma.commissionRecord.aggregate({
                        where: { salesPersonId: rep.id },
                        _sum: { amount: true },
                    }),
                ]);

                const conversionRate = assignedCount > 0 ? Math.round((convertedCount / assignedCount) * 100) : 0;

                return {
                    ...rep,
                    assignedCount,
                    quotedCount,
                    convertedCount,
                    conversionRate,
                    totalCommission: Number(commissions._sum.amount || 0),
                };
            }),
        );

        return metrics.sort((a, b) => b.conversionRate - a.conversionRate);
    }

    async getMonthlyCommissionReport(month?: string) {
        const targetMonth = month || new Date().toISOString().slice(0, 7); // YYYY-MM
        const startDate = new Date(`${targetMonth}-01T00:00:00Z`);
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);

        const records = await this.prisma.commissionRecord.findMany({
            where: { createdAt: { gte: startDate, lt: endDate } },
            include: {
                salesPerson: { select: { id: true, email: true, firstName: true, lastName: true } },
                order: { select: { id: true, orderNumber: true, totalAmount: true, status: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const totalCommission = records.reduce((sum, r) => sum + Number(r.amount || 0), 0);
        const totalDelivered = records.reduce((sum, r) => sum + Number(r.deliveredValue || 0), 0);

        return {
            month: targetMonth,
            records,
            summary: {
                totalRecords: records.length,
                totalCommission: Math.round(totalCommission * 100) / 100,
                totalDeliveredValue: Math.round(totalDelivered * 100) / 100,
                paidCount: records.filter((r) => r.status === 'paid').length,
                pendingCount: records.filter((r) => r.status === 'pending').length,
            },
        };
    }

    // ════════════════════════════════════════════════════════════════
    // MODULE 2.5 — Order Management & Fulfillment
    // ════════════════════════════════════════════════════════════════

    private static readonly VALID_TRANSITIONS: Record<string, string[]> = {
        pending_payment: ['confirmed', 'cancelled'],
        confirmed: ['in_procurement', 'processing', 'cancelled'],
        in_procurement: ['processing', 'partially_shipped', 'shipped', 'cancelled'],
        processing: ['partially_shipped', 'shipped', 'cancelled'],
        partially_shipped: ['shipped', 'delivered'],
        shipped: ['delivered', 'partially_delivered'],
        partially_delivered: ['delivered'],
    };

    async transitionOrderState(orderId: string, newStatus: string, userId: string, notes?: string) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new NotFoundException('Order not found');

        const currentStatus = order.status || 'pending_payment';
        const allowed = OperationsService.VALID_TRANSITIONS[currentStatus] || [];

        if (!allowed.includes(newStatus)) {
            throw new BadRequestException(
                `Invalid transition: ${currentStatus} → ${newStatus}. Allowed: ${allowed.join(', ') || 'none'}`,
            );
        }

        const updateData: any = { status: newStatus };

        // Stock deduction on confirmation
        if (newStatus === 'confirmed' && currentStatus === 'pending_payment') {
            await this.deductInventory(orderId);
        }

        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: updateData,
            include: { buyer: true, items: true, shipments: true },
        });

        // Audit log
        await this.createAuditLog({
            entityType: 'order',
            entityId: orderId,
            action: 'status_transition',
            details: { from: currentStatus, to: newStatus, notes },
            performedBy: userId,
        });

        return updated;
    }

    private async deductInventory(orderId: string) {
        const orderItems = await this.prisma.orderItem.findMany({
            where: { orderId },
            include: {
                quotationItem: {
                    include: {
                        cartItem: {
                            include: {
                                recommendationItem: {
                                    include: { inventorySku: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        for (const oi of orderItems) {
            const sku = (oi as any).quotationItem?.cartItem?.recommendationItem?.inventorySku;
            if (sku && sku.availableQuantity > 0) {
                const deduction = Math.min(oi.quantity, sku.availableQuantity);
                await this.prisma.inventorySku.update({
                    where: { id: sku.id },
                    data: { availableQuantity: { decrement: deduction } },
                });
            }
        }
    }

    async getFulfillmentDashboard() {
        const [orders, recentShipments, procurements] = await Promise.all([
            this.prisma.order.groupBy({
                by: ['status'],
                _count: { _all: true },
            }),
            this.prisma.shipment.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: { order: { select: { orderNumber: true } } },
            }),
            this.prisma.procurementRecord.findMany({
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: { order: { select: { orderNumber: true } }, supplier: true },
            }),
        ]);

        return {
            statusBreakdown: orders.map((o) => ({ status: o.status, count: o._count._all })),
            recentShipments,
            recentProcurements: procurements,
        };
    }
}
