require('dotenv').config();
const connectDB = require('./config/db');
const Room = require('./models/Room');
const Customer = require('./models/Customer');
const Booking = require('./models/Booking');
const Folio = require('./models/Folio');
const FolioItem = require('./models/FolioItem');

const seed = async () => {
  await Room.deleteMany({});
  await Customer.deleteMany({});
  await Booking.deleteMany({});
  await Folio.deleteMany({});
  await FolioItem.deleteMany({});

  const rooms = await Room.insertMany([
    { roomNumber: '101', category: 'standard', floor: 1, bedType: 'double', maxOccupancy: 2, housekeepingStatus: 'controlee' },
    { roomNumber: '102', category: 'standard', floor: 1, bedType: 'twin', maxOccupancy: 2, housekeepingStatus: 'propre' },
    { roomNumber: '103', category: 'superior', floor: 1, bedType: 'king', maxOccupancy: 3, housekeepingStatus: 'controlee' },
    { roomNumber: '201', category: 'superior', floor: 2, bedType: 'king', maxOccupancy: 3, housekeepingStatus: 'controlee' },
    { roomNumber: '202', category: 'suite', floor: 2, bedType: 'king', maxOccupancy: 4, housekeepingStatus: 'bloquee', blockReason: 'travaux' },
    { roomNumber: '301', category: 'suite', floor: 3, bedType: 'king', maxOccupancy: 4, housekeepingStatus: 'controlee' },
    { roomNumber: '302', category: 'lodge', floor: 3, bedType: 'king', maxOccupancy: 5, housekeepingStatus: 'propre' },
    { roomNumber: '303', category: 'lodge', floor: 3, bedType: 'king', maxOccupancy: 5, housekeepingStatus: 'sale' }
  ]);

  const customers = await Customer.insertMany([
    { firstName: 'Ahmed', lastName: 'Alami', email: 'ahmed@test.com', phone: '0600000001', nationality: 'Maroc', idType: 'cin', idNumber: 'AB123456', isVip: true, preferences: ['Chambre au soleil'], allergies: ['Gluten'] },
    { firstName: 'Sophie', lastName: 'Martin', email: 'sophie@test.com', phone: '0600000002', nationality: 'France', idType: 'passport', idNumber: 'FR987654' },
    { firstName: 'Youssef', lastName: 'Benani', email: 'youssef@test.com', phone: '0600000003', nationality: 'Maroc', idType: 'cin', idNumber: 'CD654321' },
    { firstName: 'Emma', lastName: 'Dupont', email: 'emma@test.com', phone: '0600000004', nationality: 'France', idType: 'passport', idNumber: 'FR112233', notes: 'Client fidèle - préfère lit king' }
  ]);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const bookings = await Booking.insertMany([
    {
      bookingRef: 'BK-001',
      customerId: customers[0]._id,
      roomId: rooms[0]._id,
      status: 'checked_in',
      checkInDate: yesterday,
      checkOutDate: tomorrow,
      actualCheckIn: yesterday,
      adults: 2,
      boardType: 'bb',
      roomRate: 800,
      totalAmount: 1600,
      marketSegment: 'direct_phone_mail',
      specialRequests: 'Lit bébé'
    },
    {
      bookingRef: 'BK-002',
      customerId: customers[1]._id,
      roomId: rooms[2]._id,
      status: 'confirmed',
      checkInDate: today,
      checkOutDate: nextWeek,
      adults: 2,
      children: 1,
      boardType: 'dp',
      roomRate: 1200,
      totalAmount: 8400,
      deposit: 2500,
      marketSegment: 'ota_booking'
    },
    {
      bookingRef: 'BK-003',
      customerId: customers[2]._id,
      roomId: rooms[3]._id,
      status: 'option',
      optionExpiryDate: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      checkInDate: tomorrow,
      checkOutDate: nextWeek,
      adults: 1,
      boardType: 'bb',
      roomRate: 950,
      totalAmount: 6650,
      marketSegment: 'direct_walk_in'
    },
    {
      bookingRef: 'BK-004',
      customerId: customers[3]._id,
      roomId: rooms[5]._id,
      status: 'confirmed',
      checkInDate: today,
      checkOutDate: nextWeek,
      adults: 2,
      boardType: 'pc',
      roomRate: 2000,
      totalAmount: 14000,
      deposit: 7000,
      marketSegment: 'b2b_corporate',
      specialRequests: 'Champagne au arrival'
    }
  ]);

  console.log(`✅ Seed: ${rooms.length} chambres, ${customers.length} clients, ${bookings.length} réservations`);
};

if (require.main === module) {
  connectDB().then(() => seed()).then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
  module.exports = seed;
}
