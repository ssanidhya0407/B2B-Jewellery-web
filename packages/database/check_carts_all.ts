import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const carts = await prisma.cartItem.findMany({
    include: {
        recommendationItem: {
            include: {
                inventorySku: true,
                manufacturerItem: true,
            },
        },
    },
  });
  
  if (carts.length === 0) {
     console.log("No cart items found in db!");
     return;
  }
        
  for (const c of carts) {
      const rec = c.recommendationItem;
      const src = rec.inventorySku || rec.manufacturerItem;
      if (!src?.imageUrl) {
          console.log(`Cart item ${c.id} has NO image. Source type: ${rec.sourceType}. Rec item ID: ${rec.id}`);
          console.log(JSON.stringify(rec, null, 2));
      }
  }
  console.log(`Checked ${carts.length} cart items.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
