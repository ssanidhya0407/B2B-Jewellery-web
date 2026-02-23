/**
 * seed-users.ts — Create default internal team accounts for development.
 *
 * Run:  npx tsx prisma/seed-users.ts
 *
 * Default accounts created:
 *   Admin:      admin@b2bjewellery.com     / Admin@123
 *   Sales:      sales@b2bjewellery.com     / Sales@123
 *   Operations: ops@b2bjewellery.com       / Ops@1234
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const USERS = [
    {
        email: 'admin@b2bjewellery.com',
        password: 'Admin@123',
        userType: 'admin' as const,
        firstName: 'Platform',
        lastName: 'Admin',
    },
    {
        email: 'sales@b2bjewellery.com',
        password: 'Sales@123',
        userType: 'sales' as const,
        firstName: 'Demo',
        lastName: 'Sales',
        commissionRate: 5.0,
    },
    {
        email: 'ops@b2bjewellery.com',
        password: 'Ops@1234',
        userType: 'operations' as const,
        firstName: 'Demo',
        lastName: 'Operations',
    },
];

async function main() {
    console.log('🌱 Seeding internal team users...\n');

    for (const u of USERS) {
        const existing = await prisma.user.findUnique({ where: { email: u.email } });
        if (existing) {
            console.log(`  ⏭  ${u.email} already exists (${existing.userType}, active=${existing.isActive})`);
            continue;
        }

        const passwordHash = await bcrypt.hash(u.password, 10);
        const user = await prisma.user.create({
            data: {
                email: u.email,
                passwordHash,
                userType: u.userType,
                firstName: u.firstName,
                lastName: u.lastName,
                companyName: 'B2B Jewellery',
                commissionRate: (u as any).commissionRate ?? null,
                isActive: true,
            },
        });

        console.log(`  ✅ Created ${u.userType.padEnd(8)} → ${user.email}  (password: ${u.password})`);
    }

    console.log('\n✅ Done. You can now log in at the dashboard (localhost:3002).\n');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
