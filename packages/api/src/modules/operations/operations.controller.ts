import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, Header } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators';
import { OperationsService } from './operations.service';
import { Response } from 'express';

@Controller('operations')
export class OperationsController {
    constructor(private readonly operationsService: OperationsService) { }

    @Get('dashboard') getDashboard() { return this.operationsService.getDashboard(); }
    @Get('health') getHealth() { return this.operationsService.getHealth(); }

    @Get('markups') getMarkups() { return this.operationsService.getMarkups(); }
    @Post('markups') upsertMarkup(@CurrentUser() user: User, @Body() body: { category?: string; sourceType?: string; markupPercent: number }) {
        return this.operationsService.upsertMarkup(user.id, body);
    }

    @Get('scraper-config') getScraperConfig() { return this.operationsService.getScraperConfig(); }
    @Put('scraper-config') updateScraperConfig(@CurrentUser() user: User, @Body('config') config: unknown) {
        return this.operationsService.updateScraperConfig(user.id, config);
    }

    @Get('suppliers') getSuppliers() { return this.operationsService.listSuppliers(); }
    @Post('suppliers') createSupplier(@Body() body: Record<string, unknown>) { return this.operationsService.createSupplier(body); }
    @Put('suppliers/:id') updateSupplier(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.operationsService.updateSupplier(id, body); }

    @Get('pending-products') getPendingProducts() { return this.operationsService.getPendingProducts(); }
    @Post('products/:type/:id/approve') approveProduct(@Param('type') type: 'inventory' | 'manufacturer', @Param('id') id: string) { return this.operationsService.approveProduct(type, id); }
    @Post('products/:type/:id/reject') rejectProduct(@Param('type') type: 'inventory' | 'manufacturer', @Param('id') id: string) { return this.operationsService.rejectProduct(type, id); }

    @Get('orders') getOrders(@Query('status') status?: string) { return this.operationsService.getOrders(status); }
    @Put('orders/:id/status') updateOrderStatus(@Param('id') id: string, @Body('status') status: string) { return this.operationsService.updateOrderStatus(id, status); }
    @Post('orders/:id/final-check/approve') approveFinalCheck(@Param('id') id: string, @CurrentUser() user: User) { return this.operationsService.approveFinalCheck(id, user.id); }
    @Post('orders/:id/final-check/reject') rejectFinalCheck(@Param('id') id: string, @CurrentUser() user: User, @Body('reason') reason?: string) {
        return this.operationsService.rejectFinalCheck(id, user.id, reason);
    }

    @Post('procurement') createProcurement(@Body() body: Record<string, unknown>) { return this.operationsService.createProcurement(body); }
    @Post('shipments') createShipment(@Body() body: Record<string, unknown>) { return this.operationsService.createShipment(body); }
    @Put('shipments/:id/status') updateShipmentStatus(@Param('id') id: string, @Body('status') status: string, @Body('trackingNumber') trackingNumber?: string) {
        return this.operationsService.updateShipmentStatus(id, status, trackingNumber);
    }
    @Post('payments/:id/confirm') confirmBankPayment(@Param('id') id: string, @CurrentUser() user: User) { return this.operationsService.confirmBankPayment(id, user.id); }

    @Get('inventory') listInventory(
        @Query('category') category?: string,
        @Query('search') search?: string,
        @Query('isActive') isActive?: string,
    ) {
        return this.operationsService.listInventory({ category, search, isActive });
    }
    @Get('inventory/stats') inventoryStats() { return this.operationsService.inventoryStats(); }
    @Get('inventory/:id') getInventoryItem(@Param('id') id: string) { return this.operationsService.getInventoryItem(id); }
    @Post('inventory') createInventory(@Body() body: Record<string, unknown>) { return this.operationsService.createInventory(body); }
    @Put('inventory/:id') updateInventory(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.operationsService.updateInventory(id, body); }
    @Delete('inventory/:id') deleteInventory(@Param('id') id: string) { return this.operationsService.deleteInventory(id); }

    @Get('manufacturer') listManufacturer(
        @Query('category') category?: string,
        @Query('search') search?: string,
        @Query('isVerified') isVerified?: string,
    ) {
        return this.operationsService.listManufacturerCatalog('manufacturer', { category, search, isVerified });
    }
    @Get('manufacturer/stats') manufacturerStats() { return this.operationsService.manufacturerCatalogStats('manufacturer'); }
    @Get('manufacturer/:id') getManufacturerItem(@Param('id') id: string) { return this.operationsService.getCatalogItem(id); }
    @Post('manufacturer') createManufacturerItem(@Body() body: Record<string, unknown>) { return this.operationsService.createCatalogItem('manufacturer', body); }
    @Put('manufacturer/:id') updateManufacturerItem(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.operationsService.updateCatalogItem(id, body); }
    @Delete('manufacturer/:id') deleteManufacturerItem(@Param('id') id: string) { return this.operationsService.deleteCatalogItem(id); }

    @Get('alibaba') listAlibaba(
        @Query('category') category?: string,
        @Query('search') search?: string,
        @Query('isVerified') isVerified?: string,
    ) {
        return this.operationsService.listManufacturerCatalog('alibaba', { category, search, isVerified });
    }
    @Get('alibaba/stats') alibabaStats() { return this.operationsService.manufacturerCatalogStats('alibaba'); }
    @Get('alibaba/:id') getAlibabaItem(@Param('id') id: string) { return this.operationsService.getCatalogItem(id); }
    @Post('alibaba') createAlibabaItem(@Body() body: Record<string, unknown>) { return this.operationsService.createCatalogItem('alibaba', body); }
    @Put('alibaba/:id') updateAlibabaItem(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.operationsService.updateCatalogItem(id, body); }
    @Delete('alibaba/:id') deleteAlibabaItem(@Param('id') id: string) { return this.operationsService.deleteCatalogItem(id); }

    @Get('products/stats') allProductStats() { return this.operationsService.getAllProductStats(); }

    @Get('manufacturers') listManufacturers(
        @Query('search') search?: string,
        @Query('category') category?: string,
        @Query('isActive') isActive?: string,
        @Query('isVerified') isVerified?: string,
    ) {
        return this.operationsService.listManufacturers({ search, category, isActive, isVerified });
    }
    @Get('manufacturers/stats') manufacturerProfileStats() { return this.operationsService.manufacturerStats(); }
    @Get('manufacturers/:id') getManufacturer(@Param('id') id: string) { return this.operationsService.getManufacturer(id); }
    @Post('manufacturers') createManufacturer(@Body() body: Record<string, unknown>) { return this.operationsService.createManufacturer(body); }
    @Put('manufacturers/:id') updateManufacturer(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.operationsService.updateManufacturer(id, body); }
    @Delete('manufacturers/:id') deleteManufacturer(@Param('id') id: string) { return this.operationsService.deleteManufacturer(id); }

    @Get('manufacturers/:id/products') getManufacturerProducts(
        @Param('id') id: string,
        @Query('category') category?: string,
        @Query('search') search?: string,
    ) {
        return this.operationsService.getManufacturerProducts(id, { category, search });
    }
    @Post('manufacturers/:id/products') addManufacturerProduct(@Param('id') id: string, @Body() body: Record<string, unknown>) {
        return this.operationsService.addManufacturerProduct(id, body);
    }

    @Post('stock-check/:productId') checkStock(@Param('productId') productId: string, @Body('source') source: string) {
        return this.operationsService.checkProductStock(productId, source);
    }

    @Put('stock-status/:productId') updateStockStatus(
        @Param('productId') productId: string,
        @Body('stockStatus') stockStatus: string,
        @Body('notes') notes?: string,
    ) {
        return this.operationsService.updateProductStockStatus(productId, stockStatus, notes);
    }

    @Post('carts/:cartId/validate-inventory') validateCart(@Param('cartId') cartId: string, @CurrentUser() user: User) {
        return this.operationsService.validateCartInventory(cartId, user.id);
    }

    @Post('carts/:cartId/forward-to-sales') forwardCart(
        @Param('cartId') cartId: string,
        @Body('salesPersonId') salesPersonId: string,
    ) {
        return this.operationsService.forwardToSales(cartId, salesPersonId);
    }

    @Get('sales-team') getSalesTeam() {
        return this.operationsService.getSalesTeam();
    }

    // ════════════════════════════════════════════════════════════════
    // MODULE 2.1 — Validation Endpoints
    // ════════════════════════════════════════════════════════════════

    @Get('validations')
    getValidations(
        @Query('status') status?: string,
        @Query('riskFlag') riskFlag?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
    ) {
        return this.operationsService.getValidations({
            status,
            riskFlag,
            page: page ? parseInt(page) : undefined,
            limit: limit ? parseInt(limit) : undefined,
            search,
        });
    }

    @Post('validate/batch')
    batchValidate(
        @CurrentUser() user: User,
        @Body() body: { cartItemIds: string[]; action: 'approve' | 'reject' },
    ) {
        return this.operationsService.batchValidate(body.cartItemIds, user.id, body.action);
    }

    @Get('validation/:entityType/:entityId/audit')
    getAuditTrail(@Param('entityType') entityType: string, @Param('entityId') entityId: string) {
        return this.operationsService.getAuditTrail(entityType, entityId);
    }

    // ════════════════════════════════════════════════════════════════
    // MODULE 2.2 — Enhanced Dashboard
    // ════════════════════════════════════════════════════════════════

    @Get('dashboard/enhanced')
    getEnhancedDashboard() {
        return this.operationsService.getEnhancedDashboard();
    }

    // ════════════════════════════════════════════════════════════════
    // MODULE 2.3 — Reports
    // ════════════════════════════════════════════════════════════════

    @Get('reports')
    getReports(
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('status') status?: string,
        @Query('category') category?: string,
        @Query('sourceType') sourceType?: string,
    ) {
        return this.operationsService.generateReport({ dateFrom, dateTo, status, category, sourceType });
    }

    @Get('reports/export')
    async exportReport(
        @Res() res: Response,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('status') status?: string,
        @Query('category') category?: string,
        @Query('sourceType') sourceType?: string,
    ) {
        const result = await this.operationsService.exportReportCsv({ dateFrom, dateTo, status, category, sourceType });
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.csv);
    }

    @Get('reports/templates')
    listReportTemplates(@CurrentUser() user: User) {
        return this.operationsService.listReportTemplates(user.id);
    }

    @Post('reports/templates')
    saveReportTemplate(@CurrentUser() user: User, @Body() body: { name: string; filters: any; isDefault?: boolean }) {
        return this.operationsService.saveReportTemplate(user.id, body);
    }

    @Delete('reports/templates/:id')
    deleteReportTemplate(@Param('id') id: string, @CurrentUser() user: User) {
        return this.operationsService.deleteReportTemplate(id, user.id);
    }

    // ════════════════════════════════════════════════════════════════
    // MODULE 2.4 — Sales Forwarding
    // ════════════════════════════════════════════════════════════════

    @Post('assign-auto')
    autoAssign(@CurrentUser() user: User, @Body('cartId') cartId: string) {
        return this.operationsService.autoAssignToSales(cartId, user.id);
    }

    @Get('sales-performance')
    getSalesPerformance() {
        return this.operationsService.getSalesPerformance();
    }

    @Get('commission-report')
    getCommissionReport(@Query('month') month?: string) {
        return this.operationsService.getMonthlyCommissionReport(month);
    }

    // ════════════════════════════════════════════════════════════════
    // MODULE 2.5 — Order State Machine & Fulfillment
    // ════════════════════════════════════════════════════════════════

    @Post('orders/:id/transition')
    transitionOrder(
        @Param('id') id: string,
        @CurrentUser() user: User,
        @Body() body: { status: string; notes?: string },
    ) {
        return this.operationsService.transitionOrderState(id, body.status, user.id, body.notes);
    }

    @Get('fulfillment-dashboard')
    getFulfillmentDashboard() {
        return this.operationsService.getFulfillmentDashboard();
    }
}
