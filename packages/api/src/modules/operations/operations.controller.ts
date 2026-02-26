import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { User } from '@prisma/client';
import { CurrentUser } from '../../common/decorators';
import { OperationsService } from './operations.service';

@Controller('operations')
export class OperationsController {
    constructor(private readonly operationsService: OperationsService) {}

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
}
