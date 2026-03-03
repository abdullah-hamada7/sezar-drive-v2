const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Please provide an email: node scripts/verify-device.js <email>');
    process.exit(1);
  }

  console.log(`🔍 Searching for unverified devices for ${email}...`);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error('User not found');
    process.exit(1);
  }

  const result = await prisma.userDevice.updateMany({
    where: { userId: user.id, isVerified: false },
    data: { isVerified: true }
  });

  console.log(`✅ Verified ${result.count} device(s) for ${email}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
