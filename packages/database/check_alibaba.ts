import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.manufacturerCatalog.findMany({
    where: { source: 'alibaba' }
  });
  console.log(`Found ${items.length} alibaba items`);
  for (const item of items) {
     console.log(`Item ${item.name} has image: ${item.imageUrl != null}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
