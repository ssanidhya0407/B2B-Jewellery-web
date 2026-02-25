import { PrismaClient, CartStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const userEmail = 'ssanidhya0407@gmail.com';
    const salesEmail = 'sales@b2bjewellery.com';

    console.log('--- Database Cleanup ---');

    // 1. Delete matching quotations
    // The user said "remove all the quotes that are present quoted or submitted"
    // In our system, Quotation status is usually 'sent', 'draft', etc.
    // IntendedCart status is 'submitted', 'quoted', etc.

    // Delete all quotations first (cascading deletes for quotation items if configured, 
    // but Prisma usually needs explicit deleteMany)
    const deletedQuotes = await prisma.quotation.deleteMany({
        where: {
            status: { in: ['draft', 'sent'] }
        }
    });
    console.log(`Deleted ${deletedQuotes.count} quotations.`);

    // 2. Delete matching IntendedCarts
    const deletedCarts = await prisma.intendedCart.deleteMany({
        where: {
            status: { in: ['submitted', 'quoted', 'under_review'] }
        }
    });
    console.log(`Deleted ${deletedCarts.count} intended carts.`);

    console.log('\n--- Database Seeding ---');

    // 3. Find User and Salesperson
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    const sales = await prisma.user.findUnique({ where: { email: salesEmail } });

    if (!user) {
        console.error(`User ${userEmail} not found!`);
        return;
    }
    if (!sales) {
        console.error(`Salesperson ${salesEmail} not found!`);
        return;
    }

    console.log(`Found User: ${user.id} (${user.email})`);
    console.log(`Found Sales: ${sales.id} (${sales.email})`);

    // 4. Get some items for the carts
    const skus = await prisma.inventorySku.findMany({ take: 5 });
    if (skus.length === 0) {
        console.error('No inventory SKUs found to seed carts!');
        return;
    }

    // 5. Create 2 new carts
    for (let i = 1; i <= 2; i++) {
        // Create an image session for each to make it look real (with a thumbnail)
        const session = await prisma.imageSession.create({
            data: {
                userId: user.id,
                selectedCategory: 'ring',
                originalImageUrl: 'https://placehold.co/400x400?text=Seed+Cart+' + i,
                thumbnailUrl: 'https://placehold.co/100x100?text=Ring+' + i,
                sessionStatus: 'recommendations_ready'
            }
        });

        // Create a recommendation set
        const recSet = await prisma.recommendationSet.create({
            data: {
                sessionId: session.id
            }
        });

        // Create recommendation items for the SKUs
        const recItems = await Promise.all(skus.slice(0, 2).map(sku =>
            prisma.recommendationItem.create({
                data: {
                    recommendationSetId: recSet.id,
                    sourceType: 'inventory',
                    inventorySkuId: sku.id,
                    displayPriceMin: sku.baseCost,
                    displayPriceMax: sku.baseCost.mul(1.2),
                    displayMoq: sku.moq
                }
            })
        ));

        // Create the IntendedCart
        const cart = await prisma.intendedCart.create({
            data: {
                userId: user.id,
                sessionId: session.id,
                status: 'submitted',
                assignedSalesId: sales.id,
                assignedAt: new Date(),
                submittedAt: new Date(),
                notes: `Seeded sample request #${i} for Turn 20 testing.`
            }
        });

        // Add items to the cart
        await prisma.cartItem.createMany({
            data: recItems.map(ri => ({
                cartId: cart.id,
                recommendationItemId: ri.id,
                quantity: 10 + i
            }))
        });

        console.log(`✅ Created Cart #${i}: ${cart.id}`);
    }

    console.log('\nDone!');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
