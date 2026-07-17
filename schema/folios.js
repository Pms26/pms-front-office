const { pgTable, uuid, varchar, decimal, boolean, text, timestamp, index } = require('drizzle-orm/pg-core');
const bookings = require('./bookings');

const folios = pgTable('folios', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: uuid('booking_id').notNull().references(() => bookings.id),
  folioType: varchar('folio_type', { length: 5 }).notNull(),
  label: text('label').default(''),
  status: varchar('status', { length: 20 }).notNull().default('open'),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull().default('0'),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  bookingIdFolioTypeIdx: index('idx_folios_booking_id_folio_type').on(table.bookingId, table.folioType),
}));

module.exports = folios;
