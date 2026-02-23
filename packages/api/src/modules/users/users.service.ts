import { Injectable } from '@nestjs/common';
import { UserType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

interface CreateUserData {
    email: string;
    passwordHash: string;
    userType: UserType;
    companyName?: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
}

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: CreateUserData) {
        return this.prisma.user.create({
            data: {
                email: data.email,
                passwordHash: data.passwordHash,
                userType: data.userType,
                companyName: data.companyName,
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
            },
        });
    }

    async findById(id: string) {
        return this.prisma.user.findUnique({
            where: { id },
        });
    }

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({
            where: { email },
        });
    }

    async findAll(options?: { userType?: UserType }) {
        return this.prisma.user.findMany({
            where: options?.userType ? { userType: options.userType } : undefined,
            orderBy: { createdAt: 'desc' },
        });
    }

    async update(id: string, data: Partial<CreateUserData> & { isActive?: boolean }) {
        return this.prisma.user.update({
            where: { id },
            data,
        });
    }

    async delete(id: string) {
        return this.prisma.user.delete({
            where: { id },
        });
    }
}
