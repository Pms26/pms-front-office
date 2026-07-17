require('dotenv').config();
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const schema = require('./schema');
const roomsTable = require('./schema/rooms');
const customersTable = require('./schema/customers');
const bookingsTable = require('./schema/bookings');

const seed = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  await db.delete(bookingsTable);
  await db.delete(customersTable);
  await db.delete(roomsTable);

  const createdRooms = await db.insert(roomsTable).values([
    { roomNumber: '101', category: 'standard', floor: 1, bedType: 'double', maxOccupancy: 2, housekeepingStatus: 'controlee' },
    { roomNumber: '102', category: 'standard', floor: 1, bedType: 'twin', maxOccupancy: 2, housekeepingStatus: 'propre' },
    { roomNumber: '103', category: 'superior', floor: 1, bedType: 'king', maxOccupancy: 3, housekeepingStatus: 'controlee' },
    { roomNumber: '201', category: 'superior', floor: 2, bedType: 'king', maxOccupancy: 3, housekeepingStatus: 'controlee' },
    { roomNumber: '202', category: 'suite', floor: 2, bedType: 'king', maxOccupancy: 4, housekeepingStatus: 'bloquee', blockReason: 'travaux' },
    { roomNumber: '301', category: 'suite', floor: 3, bedType: 'king', maxOccupancy: 4, housekeepingStatus: 'controlee' },
    { roomNumber: '302', category: 'lodge', floor: 3, bedType: 'king', maxOccupancy: 5, housekeepingStatus: 'propre' },
    { roomNumber: '303', category: 'lodge', floor: 3, bedType: 'king', maxOccupancy: 5, housekeepingStatus: 'sale' }
  ]).returning();

  const createdCustomers = await db.insert(customersTable).values([
    { firstName: 'Ahmed', lastName: 'Alami', email: 'ahmed@test.com', phone: '0600000001', nationality: 'Maroc', idType: 'cin', idNumber: 'AB123456', isVip: true, preferences: ['Chambre au soleil'], allergies: ['Gluten'] },
    { firstName: 'Sophie', lastName: 'Martin', email: 'sophie@test.com', phone: '0600000002', nationality: 'France', idType: 'passport', idNumber: 'FR987654' },
    { firstName: 'Youssef', lastName: 'Benani', email: 'youssef@test.com', phone: '0600000003', nationality: 'Maroc', idType: 'cin', idNumber: 'CD654321' },
    { firstName: 'Emma', lastName: 'Dupont', email: 'emma@test.com', phone: '0600000004', nationality: 'France', idType: 'passport', idNumber: 'FR112233', notes: 'Client fidèle - préfère lit king' }
  ]).returning();

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  await db.insert(bookingsTable).values([
    {
      bookingRef: 'BK-001',
      customerId: createdCustomers[0].id,
      roomId: createdRooms[0].id,
      status: 'checked_in',
      checkInDate: yesterday.toISOString().slice(0, 10),
      checkOutDate: tomorrow.toISOString().slice(0, 10),
      actualCheckIn: yesterday.toISOString().slice(0, 10),
      adults: 2,
      boardType: 'bb',
      roomRate: '800',
      totalAmount: '1600',
      marketSegment: 'direct_phone_mail',
      specialRequests: 'Lit bébé'
    },
    {
      bookingRef: 'BK-002',
      customerId: createdCustomers[1].id,
      roomId: createdRooms[2].id,
      status: 'confirmed',
      checkInDate: today.toISOString().slice(0, 10),
      checkOutDate: nextWeek.toISOString().slice(0, 10),
      adults: 2,
      children: 1,
      boardType: 'dp',
      roomRate: '1200',
      totalAmount: '8400',
      deposit: '2500',
      marketSegment: 'ota_booking'
    },
    {
      bookingRef: 'BK-003',
      customerId: createdCustomers[2].id,
      roomId: createdRooms[3].id,
      status: 'option',
      optionExpiryDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      checkInDate: tomorrow.toISOString().slice(0, 10),
      checkOutDate: nextWeek.toISOString().slice(0, 10),
      adults: 1,
      boardType: 'bb',
      roomRate: '950',
      totalAmount: '6650',
      marketSegment: 'direct_walk_in'
    },
    {
      bookingRef: 'BK-004',
      customerId: createdCustomers[3].id,
      roomId: createdRooms[5].id,
      status: 'confirmed',
      checkInDate: today.toISOString().slice(0, 10),
      checkOutDate: nextWeek.toISOString().slice(0, 10),
      adults: 2,
      boardType: 'pc',
      roomRate: '2000',
      totalAmount: '14000',
      deposit: '7000',
      marketSegment: 'b2b_corporate',
      specialRequests: 'Champagne au arrival'
    }
  ]);

  console.log(`Seed: ${createdRooms.length} chambres, ${createdCustomers.length} clients, 4 réservations`);
  await pool.end();
};

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
  module.exports = seed;
}
