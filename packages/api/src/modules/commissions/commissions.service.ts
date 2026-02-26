import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CommissionsService {
    constructor(private readonly prisma: PrismaService) {}

    private decimal(v: number) {
        return new Prisma.Decimal(Number.isFinite(v) ? v : 0);
    }

    async getActiveStructure() {
        const structure = await this.prisma.commissionStructure.findFirst({
            where: { isActive: true },
            orderBy: { updatedAt: 'desc' },
        });

        if (structure) return structure;

        return this.prisma.commissionStructure.create({
            data: {
                name: 'default',
                type: 'percentage',
                value: this.decimal(7.5),
                baseRate: this.decimal(7.5),
                thresholdAmount: this.decimal(500000),
                acceleratedRate: this.decimal(9),
                isActive: true,
            },
        });
    }

    async listStructures() {
        return this.prisma.commissionStructure.findMany({ orderBy: { updatedAt: 'desc' } });
    }

    async saveStructure(data: {
        name?: string;
        type?: string;
        value?: number;
        baseRate: number;
        highValueThreshold?: number;
        highValueRate?: number;
        paidBonusRate?: number;
    }) {
        if (!Number.isFinite(data.baseRate)) {
            throw new BadRequestException('baseRate is required');
        }

        const name = data.name || 'default';
        const type = data.type || 'percentage';
        const value = Number.isFinite(data.value as number) ? Number(data.value) : Number(data.baseRate);

        return this.prisma.$transaction(async (tx) => {
            await tx.commissionStructure.updateMany({
                where: { name, isActive: true },
                data: { isActive: false },
            });

            return tx.commissionStructure.create({
                data: {
                    name,
                    type,
                    value: this.decimal(value),
                    baseRate: this.decimal(data.baseRate),
                    thresholdAmount: data.highValueThreshold != null ? this.decimal(data.highValueThreshold) : null,
                    acceleratedRate: data.highValueRate != null ? this.decimal(data.highValueRate) : null,
                    isActive: true,
                },
            });
        });
    }

    async calculateCommission(orderId: string) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                payments: true,
                quotation: { include: { cart: true } },
            },
        });
        if (!order) throw new NotFoundException('Order not found');
        if (!order.salesPersonId) return null;

        const structure = await this.getActiveStructure();
        const total = Number(order.totalAmount || 0);
        const paidAmount = Number(order.paidAmount || 0);
        const threshold = Number(structure.thresholdAmount || 0);
        const baseRate = Number(structure.baseRate || structure.value || 0);
        const highRate = Number(structure.acceleratedRate || baseRate);
        const effectiveRate = threshold > 0 && total >= threshold ? highRate : baseRate;
        const commissionAmount = (total * effectiveRate) / 100;

        const isPaidSignal = Boolean(order.paymentConfirmedAt)
            || (total > 0 && paidAmount >= total)
            || order.payments.some((p) => ['paid', 'completed', 'success'].includes(String(p.status || '').toLowerCase()));

        const status = isPaidSignal ? 'paid' : 'pending';

        const existing = await this.prisma.commissionRecord.findFirst({ where: { orderId }, orderBy: { createdAt: 'desc' } });
        if (existing) {
            return this.prisma.commissionRecord.update({
                where: { id: existing.id },
                data: {
                    commissionRate: this.decimal(effectiveRate),
                    deliveredValue: this.decimal(total),
                    amount: this.decimal(commissionAmount),
                    status,
                },
            });
        }

        return this.prisma.commissionRecord.create({
            data: {
                orderId,
                salesPersonId: order.salesPersonId,
                commissionRate: this.decimal(effectiveRate),
                deliveredValue: this.decimal(total),
                amount: this.decimal(commissionAmount),
                status,
            },
        });
    }
}
