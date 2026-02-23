import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { UserType } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AdminService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { }

    // ============ Inventory ============

    async listInventory() {
        return this.prisma.inventorySku.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async createInventorySku(data: Record<string, unknown>) {
        return this.prisma.inventorySku.create({
            data: {
                skuCode: data.skuCode as string,
                name: data.name as string,
                description: data.description as string | undefined,
                category: data.category as string,
                primaryMetal: data.primaryMetal as string | undefined,
                stoneTypes: (data.stoneTypes as string[]) || [],
                baseCost: data.baseCost as number,
                moq: (data.moq as number) || 1,
                leadTimeDays: data.leadTimeDays as number | undefined,
                imageUrl: data.imageUrl as string,
            },
        });
    }

    async updateInventorySku(id: string, data: Record<string, unknown>) {
        return this.prisma.inventorySku.update({
            where: { id },
            data: {
                ...(typeof data.name === 'string' && data.name ? { name: data.name } : {}),
                ...(data.description !== undefined ? { description: data.description as string } : {}),
                ...(typeof data.category === 'string' && data.category ? { category: data.category } : {}),
                ...(data.primaryMetal !== undefined ? { primaryMetal: data.primaryMetal as string } : {}),
                ...(Array.isArray(data.stoneTypes) ? { stoneTypes: data.stoneTypes as string[] } : {}),
                ...(data.baseCost !== undefined ? { baseCost: data.baseCost as number } : {}),
                ...(data.moq !== undefined ? { moq: data.moq as number } : {}),
                ...(data.leadTimeDays !== undefined ? { leadTimeDays: data.leadTimeDays as number } : {}),
                ...(typeof data.imageUrl === 'string' && data.imageUrl ? { imageUrl: data.imageUrl } : {}),
                ...(data.isActive !== undefined ? { isActive: data.isActive as boolean } : {}),
            },
        });
    }

    async deleteInventorySku(id: string) {
        return this.prisma.inventorySku.update({
            where: { id },
            data: { isActive: false },
        });
    }

    // ============ Margins ============

    async getMarginConfigs() {
        return this.prisma.marginConfiguration.findMany({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
        });
    }

    async createMarginConfig(data: Record<string, unknown>, createdById: string) {
        return this.prisma.marginConfiguration.create({
            data: {
                category: data.category as string | undefined,
                sourceType: data.sourceType as string | undefined,
                marginPercentage: data.marginPercentage as number,
                minMarkup: data.minMarkup as number | undefined,
                maxMarkup: data.maxMarkup as number | undefined,
                createdById,
            },
        });
    }

    async updateMarginConfig(id: string, data: Record<string, unknown>) {
        return this.prisma.marginConfiguration.update({
            where: { id },
            data: {
                ...(data.marginPercentage !== undefined && { marginPercentage: data.marginPercentage as number }),
                ...(data.minMarkup !== undefined && { minMarkup: data.minMarkup as number }),
                ...(data.maxMarkup !== undefined && { maxMarkup: data.maxMarkup as number }),
                ...(data.isActive !== undefined && { isActive: data.isActive as boolean }),
            },
        });
    }

    // ============ Users ============

    async listUsers() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                userType: true,
                companyName: true,
                firstName: true,
                lastName: true,
                isActive: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async updateUser(id: string, data: { isActive?: boolean; userType?: UserType }) {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }

    async inviteInternalUser(
        data: { email: string; userType: UserType; firstName?: string; lastName?: string },
        invitedById: string,
    ) {
        const normalizedEmail = data.email.trim().toLowerCase();
        const allowedRoles: UserType[] = [UserType.sales, UserType.operations, UserType.admin];

        if (!allowedRoles.includes(data.userType)) {
            throw new BadRequestException('Invite role must be sales, operations, or admin');
        }

        let user = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });

        const temporaryPasswordHash = await bcrypt.hash(randomUUID(), 10);

        if (user) {
            if (user.userType === UserType.external) {
                throw new ConflictException('External user already exists with this email');
            }

            user = await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    userType: data.userType,
                    firstName: data.firstName ?? user.firstName ?? undefined,
                    lastName: data.lastName ?? user.lastName ?? undefined,
                    isActive: false,
                    passwordHash: temporaryPasswordHash,
                },
            });
        } else {
            user = await this.prisma.user.create({
                data: {
                    email: normalizedEmail,
                    passwordHash: temporaryPasswordHash,
                    userType: data.userType,
                    firstName: data.firstName,
                    lastName: data.lastName,
                    isActive: false,
                    companyName: 'Internal',
                },
            });
        }

        const token = this.authService.createInternalActivationToken(user.id, user.email, user.userType);
        const webUrl = this.configService.get<string>('app.webUrl') || 'http://localhost:3000';
        const activationLink = `${webUrl}/activate-invite?token=${encodeURIComponent(token)}`;

        return {
            invitedUser: {
                id: user.id,
                email: user.email,
                userType: user.userType,
                firstName: user.firstName,
                lastName: user.lastName,
                isActive: user.isActive,
            },
            activationLink,
            invitedById,
            expiresIn: '7d',
        };
    }

    // ============ Manufacturers ============

    async listManufacturers() {
        return this.prisma.manufacturerCatalog.findMany({
            orderBy: { createdAt: 'desc' },
        });
    }

    async createManufacturer(data: Record<string, unknown>) {
        return this.prisma.manufacturerCatalog.create({
            data: {
                manufacturerRef: data.manufacturerRef as string | undefined,
                name: data.name as string,
                description: data.description as string | undefined,
                category: data.category as string,
                primaryMetal: data.primaryMetal as string | undefined,
                stoneTypes: (data.stoneTypes as string[]) || [],
                baseCostMin: data.baseCostMin as number | undefined,
                baseCostMax: data.baseCostMax as number | undefined,
                moq: (data.moq as number) || 50,
                leadTimeDays: data.leadTimeDays as number | undefined,
                imageUrl: data.imageUrl as string | undefined,
                qualityTier: (data.qualityTier as string) || 'standard',
            },
        });
    }

    async updateManufacturer(id: string, data: Record<string, unknown>) {
        return this.prisma.manufacturerCatalog.update({
            where: { id },
            data: {
                ...(typeof data.name === 'string' && data.name ? { name: data.name } : {}),
                ...(data.description !== undefined ? { description: data.description as string } : {}),
                ...(typeof data.category === 'string' && data.category ? { category: data.category } : {}),
                ...(data.baseCostMin !== undefined ? { baseCostMin: data.baseCostMin as number } : {}),
                ...(data.baseCostMax !== undefined ? { baseCostMax: data.baseCostMax as number } : {}),
                ...(data.moq !== undefined ? { moq: data.moq as number } : {}),
                ...(data.isVerified !== undefined ? { isVerified: data.isVerified as boolean } : {}),
            },
        });
    }
}
