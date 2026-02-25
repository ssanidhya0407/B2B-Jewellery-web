import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log("Checking recommendation items...");
    const items = await prisma.recommendationItem.findMany({
        include: { inventorySku: true, manufacturerItem: true }
    });
    console.log(`Found ${items.length} recommendation items.`);
    let missingImages = 0;
    for (const item of items) {
        const img = item.inventorySku?.imageUrl || item.manufacturerItem?.imageUrl || null;
        if (!img) {
            missingImages++;
        }
    }
    console.log(`${missingImages} items missing images.`);

    console.log("Checking cart items...");
    const cartItems = await prisma.cartItem.findMany({
        include: { recommendationItem: { include: { inventorySku: true, manufacturerItem: true } } }
    });
    console.log(`Found ${cartItems.length} cart items.`);
    let missingCartImages = 0;
    for (const item of cartItems) {
        const img = item.recommendationItem?.inventorySku?.imageUrl || item.recommendationItem?.manufacturerItem?.imageUrl || null;
        if (!img) {
            missingCartImages++;
            console.log("CartItem missing image:", item.id);
        }
    }
    console.log(`${missingCartImages} cart items missing images.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
