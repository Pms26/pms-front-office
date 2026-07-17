const { pgTable, uuid, varchar, integer, decimal, boolean, text, timestamp, index } = require('drizzle-orm/pg-core');
const folios = require('./folios');

const folioItems = pgTable('folio_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  folioId: uuid('folio_id').notNull().references(() => folios.id),
  description: text('description').notNull(),
  category: varchar('category', { length: 30 }).notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalAmount: decimal('total_amount', { precision: 12, scale: 2 }).notNull(),
  taxRate: decimal('tax_rate', { precision: 5, scale: 2 }).default('0'),
  isVisibleOnPrint: boolean('is_visible_on_print').notNull().default(true),
  date: timestamp('date', { withTimezone: true }).defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  folioIdIdx: index('idx_folio_items_folio_id').on(table.folioId),
}));

module.exports = folioItems;
