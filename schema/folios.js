const { pgTable, uuid, varchar, decimal, boolean, text, timestamp, index } = require('drizzle-orm/pg-core');

const folios = pgTable('folios', {
  id: uuid('id').primaryKey().defaultRandom(),
  bookingId: varchar('booking_id', { length: 50 }).notNull(),
  bookingRef: varchar('booking_ref', { length: 30 }),
  billToPartnerId: varchar('bill_to_partner_id', { length: 100 }),
  billToLabel: varchar('bill_to_label', { length: 100 }),
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
