const { pgTable, uuid, varchar, integer, boolean, text, timestamp, index } = require('drizzle-orm/pg-core');

const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  email: varchar('email', { length: 200 }),
  phone: varchar('phone', { length: 30 }),
  nationality: varchar('nationality', { length: 50 }),
  idType: varchar('id_type', { length: 20 }).notNull().default('cin'),
  idNumber: varchar('id_number', { length: 50 }),
  dateOfBirth: timestamp('date_of_birth', { withTimezone: true }),
  addressStreet: varchar('address_street', { length: 200 }),
  addressCity: varchar('address_city', { length: 100 }),
  addressCountry: varchar('address_country', { length: 50 }),
  addressZipCode: varchar('address_zip_code', { length: 20 }),
  preferences: text('preferences').array(),
  allergies: text('allergies').array(),
  notes: text('notes').default(''),
  isVip: boolean('is_vip').notNull().default(false),
  totalStays: integer('total_stays').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  lastNameFirstNameIdx: index('idx_customers_last_name_first_name').on(table.lastName, table.firstName),
  phoneIdx: index('idx_customers_phone').on(table.phone),
}));

module.exports = customers;
