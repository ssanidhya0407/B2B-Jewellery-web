import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import { User, UserType } from '@prisma/client';
import { OperationsService } from './operations.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';

@Controller('operations')
@UseGuards(RolesGuard)
@Roles(UserType.operations, UserType.admin)
export class OperationsController {
    constructor(private readonly opsService: OperationsService) {}

    // ─── Dashboard ───

    @Get('dashboard')
    async getDashboard() {
        return this.opsService.getDashboardMetrics();
    }

    @Get('health')
    async getSystemHealth() {
        return this.opsService.getSystemHealth();
    }

    // ─── Markup Management ───

    @Get('markups')
    async getMarkups() {
        return this.opsService.getMarkupConfigs();
    }

    @Post('markups')
    async createMarkup(@Body() data: any, @CurrentUser() user: User) {
        return this.opsService.upsertMarkup(data, user.id);
    }

    // ─── Scraper Config ───

    @Get('scraper-config')
    async getScraperConfig() {
        return this.opsService.getScraperConfig();
    }

    @Put('scraper-config')
    async updateScraperConfig(@Body() data: any, @CurrentUser() user: User) {
        return this.opsService.updateScraperConfig(data, user.id);
    }

    // ─── Suppliers ───

    @Get('suppliers')
    async getSuppliers() {
        return this.opsService.getSuppliers();
    }

    @Post('suppliers')
    async createSupplier(@Body() data: any) {
        return this.opsService.createSupplier(data);
    }

    @Put('suppliers/:id')
    async updateSupplier(@Param('id') id: string, @Body() data: any) {
        return this.opsService.updateSupplier(id, data);
    }

    // ─── Product Approval ───

    @Get('pending-products')
    async getPendingProducts() {
        return this.opsService.getPendingProducts();
    }

    @Post('products/:type/:id/approve')
    async approveProduct(@Param('type') type: string, @Param('id') id: string) {
        return this.opsService.approveProduct(type as 'inventory' | 'manufacturer', id);
    }

    @Post('products/:type/:id/reject')
    async rejectProduct(@Param('type') type: string, @Param('id') id: string) {
        return this.opsService.rejectProduct(type as 'inventory' | 'manufacturer', id);
    }

    // ═══════════════════════════════════════════════════════════════
    // QUOTATION WORKFLOW — Phase 2: Validate & Forward
    // ═══════════════════════════════════════════════════════════════

    @Post('carts/:id/validate-inventory')
    async validateCartInventory(@Param('id') cartId: string, @CurrentUser() user: User) {
        return this.opsService.validateCartInventory(cartId, user.id);
    }

    @Post('carts/:id/forward-to-sales')
    async forwardToSales(
        @Param('id') cartId: string,
        @Body('salesPersonId') salesPersonId: string,
        @CurrentUser() user: User,
    ) {
        return this.opsService.forwardToSales(cartId, salesPersonId, user.id);
    }

    @Get('sales-team')
    async getSalesTeamMembers() {
        return this.opsService.getSalesTeamMembers();
    }

    // ═══════════════════════════════════════════════════════════════
    // QUOTATION WORKFLOW — Expiry Cron Jobs
    // ═══════════════════════════════════════════════════════════════

    @Post('cron/expire-payments')
    async expireOverduePayments() {
        return this.opsService.expireOverduePayments();
    }

    @Post('cron/send-reminders')
    async sendExpiryReminders() {
        return this.opsService.sendExpiryReminders();
    }

    // ─── Orders / Procurement / Shipping ───

    @Get('orders')
    async getOrders(@Query('status') status?: string) {
        return this.opsService.getOrders(status);
    }

    @Put('orders/:id/status')
    async updateOrderStatus(@Param('id') id: string, @Body('status') status: string) {
        return this.opsService.updateOrderStatus(id, status);
    }

    @Post('orders/:id/procurement')
    async createProcurement(@Param('id') orderId: string, @Body() data: any) {
        return this.opsService.createProcurementRecord({ ...data, orderId });
    }

    @Put('procurement/:id/status')
    async updateProcurementStatus(
        @Param('id') id: string,
        @Body() data: { status: string; notes?: string },
    ) {
        return this.opsService.updateProcurementStatus(id, data.status, data.notes);
    }

    @Post('orders/:id/shipment')
    async createShipment(@Param('id') orderId: string, @Body() data: any) {
        return this.opsService.createShipment({ ...data, orderId });
    }

    @Put('shipments/:id/status')
    async updateShipmentStatus(
        @Param('id') id: string,
        @Body() data: { status: string; trackingNumber?: string },
    ) {
        return this.opsService.updateShipmentStatus(id, data.status, data.trackingNumber);
    }

    // ─── Inventory Management ───

    @Get('inventory')
    async listInventory(
        @Query('category') category?: string,
        @Query('search') search?: string,
        @Query('isActive') isActive?: string,
    ) {
        return this.opsService.listInventory({ category, search, isActive });
    }

    @Get('inventory/stats')
    async getInventoryStats() {
        return this.opsService.getInventoryStats();
    }

    @Get('inventory/:id')
    async getInventoryItem(@Param('id') id: string) {
        return this.opsService.getInventoryById(id);
    }

    @Post('inventory')
    async createInventoryItem(@Body() data: any) {
        return this.opsService.createInventoryItem(data);
    }

    @Put('inventory/:id')
    async updateInventoryItem(@Param('id') id: string, @Body() data: any) {
        return this.opsService.updateInventoryItem(id, data);
    }

    @Delete('inventory/:id')
    async deleteInventoryItem(@Param('id') id: string) {
        return this.opsService.deleteInventoryItem(id);
    }

    // ─── Payment Confirmation ───

    @Post('payments/:id/confirm')
    async confirmPayment(@Param('id') id: string, @CurrentUser() user: User) {
        return this.opsService.confirmBankPayment(id, user.id);
    }

    // ═══════════════════════════════════════════════════════════════
    // MANUFACTURER CATALOG
    // ═══════════════════════════════════════════════════════════════

    @Get('manufacturer')
    async listManufacturer(
        @Query('category') category?: string,
        @Query('search') search?: string,
        @Query('isVerified') isVerified?: string,
    ) {
        return this.opsService.listManufacturerItems({ category, search, isVerified });
    }

    @Get('manufacturer/stats')
    async getManufacturerStats() {
        return this.opsService.getManufacturerStats();
    }

    @Get('manufacturer/:id')
    async getManufacturerItem(@Param('id') id: string) {
        return this.opsService.getManufacturerItemById(id);
    }

    @Post('manufacturer')
    async createManufacturerItem(@Body() data: any) {
        return this.opsService.createManufacturerItem(data);
    }

    @Put('manufacturer/:id')
    async updateManufacturerItem(@Param('id') id: string, @Body() data: any) {
        return this.opsService.updateManufacturerItem(id, data);
    }

    @Delete('manufacturer/:id')
    async deleteManufacturerItem(@Param('id') id: string) {
        return this.opsService.deleteManufacturerItem(id);
    }

    // ═══════════════════════════════════════════════════════════════
    // ALIBABA CATALOG
    // ═══════════════════════════════════════════════════════════════

    @Get('alibaba')
    async listAlibaba(
        @Query('category') category?: string,
        @Query('search') search?: string,
        @Query('isVerified') isVerified?: string,
    ) {
        return this.opsService.listAlibabaItems({ category, search, isVerified });
    }

    @Get('alibaba/stats')
    async getAlibabaStats() {
        return this.opsService.getAlibabaStats();
    }

    @Get('alibaba/:id')
    async getAlibabaItem(@Param('id') id: string) {
        return this.opsService.getAlibabaItemById(id);
    }

    @Post('alibaba')
    async createAlibabaItem(@Body() data: any) {
        return this.opsService.createAlibabaItem(data);
    }

    @Put('alibaba/:id')
    async updateAlibabaItem(@Param('id') id: string, @Body() data: any) {
        return this.opsService.updateAlibabaItem(id, data);
    }

    @Delete('alibaba/:id')
    async deleteAlibabaItem(@Param('id') id: string) {
        return this.opsService.deleteAlibabaItem(id);
    }

    // ═══════════════════════════════════════════════════════════════
    // MANUFACTURER PROFILES (3rd-party manufacturer management)
    // ═══════════════════════════════════════════════════════════════

    @Get('manufacturers')
    async listManufacturers(
        @Query('search') search?: string,
        @Query('category') category?: string,
        @Query('isActive') isActive?: string,
        @Query('isVerified') isVerified?: string,
    ) {
        return this.opsService.listManufacturers({ search, category, isActive, isVerified });
    }

    @Get('manufacturers/stats')
    async getManufacturersStats() {
        return this.opsService.getManufacturersStats();
    }

    @Get('manufacturers/:id')
    async getManufacturerProfile(@Param('id') id: string) {
        return this.opsService.getManufacturerById(id);
    }

    @Post('manufacturers')
    async createManufacturer(@Body() data: any) {
        return this.opsService.createManufacturer(data);
    }

    @Put('manufacturers/:id')
    async updateManufacturer(@Param('id') id: string, @Body() data: any) {
        return this.opsService.updateManufacturer(id, data);
    }

    @Delete('manufacturers/:id')
    async deleteManufacturer(@Param('id') id: string) {
        return this.opsService.deleteManufacturer(id);
    }

    @Get('manufacturers/:id/products')
    async getManufacturerProducts(
        @Param('id') manufacturerId: string,
        @Query('category') category?: string,
        @Query('search') search?: string,
    ) {
        return this.opsService.getManufacturerProducts(manufacturerId, { category, search });
    }

    @Post('manufacturers/:id/products')
    async addManufacturerProduct(@Param('id') manufacturerId: string, @Body() data: any) {
        return this.opsService.addManufacturerProduct(manufacturerId, data);
    }

    // ─── Stock Check (Quotation Flow) ───

    @Post('stock-check/:productId')
    async checkProductStock(
        @Param('productId') productId: string,
        @Body() data: { source: string },
    ) {
        return this.opsService.checkProductStock(productId, data.source);
    }

    @Put('stock-status/:productId')
    async updateStockStatus(
        @Param('productId') productId: string,
        @Body() data: { stockStatus: string; notes?: string },
    ) {
        return this.opsService.updateProductStockStatus(productId, data.stockStatus, data.notes);
    }

    // ─── All Sources Combined Stats ───

    @Get('products/stats')
    async getAllProductStats() {
        return this.opsService.getAllProductStats();
    }
}
