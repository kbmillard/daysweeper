import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const now = new Date();

  await prisma.user.upsert({
    where: { id: 'user_398mOUQq9Q9gADFhyfICKW4pWFF' },
    update: { email: 'kylemillard@recyclicbravery.com', updatedAt: now },
    create: {
      id: 'user_398mOUQq9Q9gADFhyfICKW4pWFF',
      email: 'kylemillard@recyclicbravery.com',
      createdAt: now,
      updatedAt: now
    }
  });

  console.log('Seeded user: Kyle Millard (kylemillard@recyclicbravery.com)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
