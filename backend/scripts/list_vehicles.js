require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const vehicles = await prisma.vehicle.findMany();
  console.log('Vehicles in DB:', JSON.stringify(vehicles, null, 2));
}

main().finally(() => prisma.$disconnect());
