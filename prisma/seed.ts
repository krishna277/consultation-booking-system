import { PrismaClient, SlotStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import 'dotenv/config';

// 1. Establish a native PG connection pool using your environment string
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);

// 2. Instantiate Prisma Client with the mandatory v7 adapter object
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting database seeding script...');

  // 1. Clear transaction records first to satisfy relational integrity constraints
  await prisma.booking.deleteMany();
  console.log('🗑️ Bookings table cleared completely.');

  // 2. Clear parent consultation configurations cleanly
  await prisma.slot.deleteMany();
  console.log('🗑️ Slots table cleared completely.');

  // 3. Force PostgreSQL sequence tracking wheels back to base index 1
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS slots_id_seq RESTART WITH 1;`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE IF EXISTS bookings_id_seq RESTART WITH 1;`);
  console.log('🔄 All auto-increment ID sequence trackers have been reset back to 1.')
 
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log('⏳ Generating testing consultation slots...');
  await prisma.slot.createMany({
    data: [
      {
        id: 1, 
        doctorId: 'doc_house_01',
        startTime: new Date(tomorrow.setHours(9, 0, 0, 0)),
        endTime: new Date(tomorrow.setHours(10, 0, 0, 0)),
        status: SlotStatus.AVAILABLE,
        version: 0, 
      },
      {
        id: 2,
        doctorId: 'doc_house_01',
        startTime: new Date(tomorrow.setHours(10, 30, 0, 0)),
        endTime: new Date(tomorrow.setHours(11, 30, 0, 0)),
        status: SlotStatus.AVAILABLE,
        version: 0,
      },
    ],
  });

  console.log('✅ Seeding complete! Database successfully populated.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding process crashed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Cleanly close the pool connection stream
  });
