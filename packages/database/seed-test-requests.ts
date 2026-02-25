import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Removing ALL old requests and relations...');
  await prisma.payment.deleteMany({});
  await prisma.shipment.deleteMany({});
  await prisma.procurementRecord.deleteMany({});
  await prisma.commissionRecord.deleteMany({});

  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});

  await prisma.negotiationRoundItem.deleteMany({});
  await prisma.negotiationRound.deleteMany({});
  await prisma.negotiation.deleteMany({});

  await prisma.quotationItem.deleteMany({});
  await prisma.quotation.deleteMany({});

  await prisma.message.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.intendedCart.deleteMany({});
  console.log('Old data removed entirely.');

  const buyer = await prisma.user.findUnique({ where: { email: 'ssanidhya0407@gmail.com' } });
  const sales = await prisma.user.findUnique({ where: { email: 'sales@b2bjewellery.com' } });

  if (!buyer || !sales) {
    console.error('Buyer or Sales rep not found');
    return;
  }

  console.log('Found buyer:', buyer.id);
  console.log('Found sales:', sales.id);

  const recommItems = await prisma.recommendationItem.findMany({ take: 3 });

  if (recommItems.length < 2) {
    console.error('Not enough recommendation items found to add to cart.');
  }

  const item1Target = recommItems[0]?.id;
  const item2Target = recommItems.length > 1 ? recommItems[1].id : (item1Target || undefined);

  if (item1Target) {
    const req1 = await prisma.intendedCart.create({
      data: {
        userId: buyer.id,
        assignedSalesId: sales.id,
        assignedAt: new Date(),
        status: 'under_review',
        notes: 'I need bulk supply of these for my new store opening.',
        items: {
          create: [
            {
              recommendationItemId: item1Target,
              quantity: 50,
              itemNotes: 'Need them in 18k gold',
            }
          ]
        }
      }
    });
    console.log('Created request 1:', req1.id);
  }

  if (item2Target) {
    const req2 = await prisma.intendedCart.create({
      data: {
        userId: buyer.id,
        assignedSalesId: sales.id,
        assignedAt: new Date(),
        status: 'under_review',
        notes: 'Looking for unique statement pieces',
        items: {
          create: [
            {
              recommendationItemId: item2Target,
              quantity: 12,
            }
          ]
        }
      }
    });
    console.log('Created request 2:', req2.id);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
