require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const qr = 'QR-1771101653513';
  await prisma.vehicle.update({
    where: { qrCode: qr },
    data: { isActive: true, status: 'available' }
  });
  console.log(`Vehicle ${qr} activated and set to available.`);
}

main().finally(() => prisma.$disconnect());
