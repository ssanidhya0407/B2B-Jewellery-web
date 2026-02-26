import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class OperationsService {
    constructor(private readonly prisma: PrismaService) {}

    private asDecimal(v?: number | string | null) {
        return new Prisma.Decimal(Number(v || 0));
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

        return this.prisma.intendedCart.update({
            where: { id: cartId },
            data: {
                assignedSalesId: salesPersonId,
                assignedAt: new Date(),
                status: 'under_review',
            },
            include: { assignedSales: true },
        });
    }

    async getSalesTeam() {
        return this.prisma.user.findMany({
            where: { userType: 'sales', isActive: true },
            select: { id: true, email: true, firstName: true, lastName: true, companyName: true },
            orderBy: { createdAt: 'asc' },
        });
    }
}
