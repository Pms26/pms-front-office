const { pgTable, uuid, varchar, integer, decimal, boolean, text, timestamp, date, index } = require('drizzle-orm/pg-core');
const rooms = require('./rooms');
const customers = require('./customers');

const bookings = pgTable('bookings', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingRef: varchar('booking_ref', { length: 30 }).notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => customers.id),
  roomId: uuid('room_id').notNull().references(() => rooms.id),
  status: varchar('status', { length: 20 }).notNull().default('option'),
  optionExpiryDate: timestamp('option_expiry_date', { withTimezone: true }),
  checkInDate: date('check_in_date').notNull(),
  checkOutDate: date('check_out_date').notNull(),
  actualCheckIn: date('actual_check_in'),
  actualCheckOut: date('actual_check_out'),
  adults: integer('adults').notNull().default(1),
  children: integer('children').notNull().default(0),
  boardType: varchar('board_type', { length: 10 }).notNull().default('bb'),
  roomRate: decimal('room_rate', { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  deposit: decimal('deposit', { precision: 12, scale: 2 }).default('0'),
  depositDueDate: timestamp('deposit_due_date', { withTimezone: true }),
  taxesAtReservation: boolean('taxes_at_reservation').notNull().default(true),
  specialRequests: text('special_requests'),
  cancellationPolicy: text('cancellation_policy'),
  marketSegment: varchar('market_segment', { length: 30 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  statusCheckInIdx: index('idx_bookings_status_check_in').on(table.status, table.checkInDate),
  roomCheckInCheckOutIdx: index('idx_bookings_room_check_in_check_out').on(table.roomId, table.checkInDate, table.checkOutDate),
  customerIdIdx: index('idx_bookings_customer_id').on(table.customerId),
}));

module.exports = bookings;
