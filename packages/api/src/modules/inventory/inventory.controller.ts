import { Controller, Get, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';

@Controller('inventory')
export class InventoryController {
    constructor(private readonly inventoryService: InventoryService) { }

    @Get()
    async listInventory(
        @Query('category') category?: string,
        @Query('limit') limit?: number,
        @Query('offset') offset?: number,
    ) {
        return this.inventoryService.findAll({
            category,
            limit: limit || 20,
            offset: offset || 0,
        });
    }

    @Get('categories')
    async getCategories() {
        return this.inventoryService.getCategories();
    }
}
