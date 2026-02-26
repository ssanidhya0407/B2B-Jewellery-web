import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CommissionsService } from './commissions.service';

@Controller('commissions')
export class CommissionsController {
    constructor(private readonly commissionsService: CommissionsService) {}

    @Get('structures')
    async getStructures() {
        return this.commissionsService.listStructures();
    }

    @Post('structures')
    async saveStructure(@Body() body: { name?: string; type?: string; value?: number; baseRate?: number; highValueRate?: number; highValueThreshold?: number; paidBonusRate?: number }) {
        return this.commissionsService.saveStructure({
            name: body.name,
            type: body.type,
            value: body.value,
            baseRate: Number(body.baseRate ?? body.value ?? 7.5),
            highValueRate: body.highValueRate != null ? Number(body.highValueRate) : undefined,
            highValueThreshold: body.highValueThreshold != null ? Number(body.highValueThreshold) : undefined,
            paidBonusRate: body.paidBonusRate != null ? Number(body.paidBonusRate) : undefined,
        });
    }

    @Post('orders/:orderId/calculate')
    async calculateForOrder(@Param('orderId') orderId: string) {
        return this.commissionsService.calculateCommission(orderId);
    }
}
