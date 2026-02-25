import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const req = await prisma.intendedCart.findFirst({
        where: { status: { in: ['submitted', 'under_review', 'quoted', 'closed'] } }
    });
    if (!req) {
        console.log("no requests");
        return;
    }
    const cartId = req.id;

    const cart = await prisma.intendedCart.findUnique({
        where: { id: cartId },
        include: {
            items: {
                include: {
                    recommendationItem: {
                        include: {
                            inventorySku: true,
                            manufacturerItem: true,
                        },
                    },
                },
            },
        },
    });

    console.log(JSON.stringify(cart?.items, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
