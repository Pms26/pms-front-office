const { pgTable, uuid, varchar, timestamp } = require('drizzle-orm/pg-core');

const marketSegments = pgTable('market_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  label: varchar('label', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

module.exports = marketSegments;
