const { pgTable, uuid, varchar, decimal, text, timestamp, index } = require('drizzle-orm/pg-core');
const bookings = require('./bookings');
const folios = require('./folios');

const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id),
  folioId: uuid('folio_id').notNull().references(() => folios.id),
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: varchar('payment_method', { length: 30 }).notNull(),
  cardType: varchar('card_type', { length: 20 }),
  reference: text('reference'),
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  bookingIdIdx: index('idx_payments_booking_id').on(table.bookingId),
}));

module.exports = payments;
