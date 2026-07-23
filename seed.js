require('dotenv').config();
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const schema = require('./schema');
const roomsTable = require('./schema/rooms');
const customersTable = require('./schema/customers');
const marketSegmentsTable = require('./schema/marketSegments');
const foliosTable = require('./schema/folios');

const seed = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool, { schema });

  await db.delete(foliosTable);
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

  await db.insert(marketSegmentsTable).values([
    { code: 'direct_phone_mail', label: 'Téléphone/Email direct' },
    { code: 'ota_booking', label: 'Réservation OTA' },
    { code: 'direct_walk_in', label: 'Walk-in direct' },
    { code: 'b2b_corporate', label: 'Corporate B2B' }
  ]).returning();

  console.log(`Seed: ${createdRooms.length} chambres, ${createdCustomers.length} clients, 4 segments`);
  await pool.end();
};

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
  module.exports = seed;
}
