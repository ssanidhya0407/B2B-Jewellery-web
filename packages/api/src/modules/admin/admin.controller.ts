import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    UseGuards,
} from '@nestjs/common';
import { User, UserType } from '@prisma/client';
import { AdminService } from './admin.service';
import { CurrentUser, Roles } from '../../common/decorators';
import { RolesGuard } from '../../common/guards';

@Controller('admin')
@UseGuards(RolesGuard)
@Roles(UserType.admin)
export class AdminController {
    constructor(private readonly adminService: AdminService) { }

    // ============ Inventory Management ============

    @Get('inventory')
    async listInventory() {
        return this.adminService.listInventory();
    }

    @Post('inventory')
    async createInventory(@Body() data: Record<string, unknown>) {
        return this.adminService.createInventorySku(data);
    }

    @Put('inventory/:id')
    async updateInventory(@Param('id') id: string, @Body() data: Record<string, unknown>) {
        return this.adminService.updateInventorySku(id, data);
    }

    @Delete('inventory/:id')
    async deleteInventory(@Param('id') id: string) {
        return this.adminService.deleteInventorySku(id);
    }

    // ============ Margin Configuration ============

    @Get('margins')
    async getMargins() {
        return this.adminService.getMarginConfigs();
    }

    @Post('margins')
    async createMargin(@Body() data: Record<string, unknown>, @CurrentUser() user: User) {
        return this.adminService.createMarginConfig(data, user.id);
    }

    @Put('margins/:id')
    async updateMargin(@Param('id') id: string, @Body() data: Record<string, unknown>) {
        return this.adminService.updateMarginConfig(id, data);
    }

    // ============ User Management ============

    @Get('users')
    async listUsers() {
        return this.adminService.listUsers();
    }

    @Put('users/:id')
    async updateUser(@Param('id') id: string, @Body() data: { isActive?: boolean; userType?: UserType }) {
        return this.adminService.updateUser(id, data);
    }

    @Post('users/invite')
    async inviteInternalUser(
        @Body() data: { email: string; userType: UserType; firstName?: string; lastName?: string },
        @CurrentUser() user: User,
    ) {
        return this.adminService.inviteInternalUser(data, user.id);
    }

    // ============ Manufacturer Catalog ============

    @Get('manufacturers')
    async listManufacturers() {
        return this.adminService.listManufacturers();
    }

    @Post('manufacturers')
    async createManufacturer(@Body() data: Record<string, unknown>) {
        return this.adminService.createManufacturer(data);
    }

    @Put('manufacturers/:id')
    async updateManufacturer(@Param('id') id: string, @Body() data: Record<string, unknown>) {
        return this.adminService.updateManufacturer(id, data);
    }
}
