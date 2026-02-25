import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const req = await prisma.cartItem.findFirst({
        where: {
            recommendationItem: {
                sourceType: 'manufacturer'
            }
        },
        include: {
            recommendationItem: {
                include: {
                    manufacturerItem: true,
                },
            },
        },
    });

    if (!req) {
        console.log("No cart items from alibaba found in db!");
        return;
    }

    console.log(JSON.stringify(req, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
