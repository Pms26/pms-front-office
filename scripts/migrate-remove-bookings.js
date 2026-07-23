/**
 * Migration: Remove bookings table, change folios/payments booking_id to varchar
 * 
 * This migration:
 * 1. Drops foreign key constraints on folios.booking_id and payments.booking_id
 * 2. Changes booking_id from UUID to varchar(50) in both tables
 * 3. Adds booking_ref, bill_to_partner_id, bill_to_label to folios
 * 4. Drops the bookings table
 * 
 * Run: node scripts/migrate-remove-bookings.js
 */
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Drop foreign key constraints
    console.log('Dropping FK constraints...');

    // Find and drop FK constraint on folios.booking_id
    const foliosFK = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'folios'::regclass
      AND confrelid = 'bookings'::regclass
      AND contype = 'f'
    `);
    for (const row of foliosFK.rows) {
      console.log(`  Dropping constraint: ${row.conname}`);
      await client.query(`ALTER TABLE folios DROP CONSTRAINT "${row.conname}"`);
    }

    // Find and drop FK constraint on payments.booking_id
    const paymentsFK = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'payments'::regclass
      AND confrelid = 'bookings'::regclass
      AND contype = 'f'
    `);
    for (const row of paymentsFK.rows) {
      console.log(`  Dropping constraint: ${row.conname}`);
      await client.query(`ALTER TABLE payments DROP CONSTRAINT "${row.conname}"`);
    }

    // 2. Alter folios.booking_id from UUID to varchar(50)
    console.log('Altering folios.booking_id to varchar(50)...');
    await client.query(`ALTER TABLE folios ALTER COLUMN booking_id TYPE varchar(50) USING booking_id::text`);

    // 3. Add new columns to folios
    console.log('Adding new columns to folios...');
    await client.query(`ALTER TABLE folios ADD COLUMN IF NOT EXISTS booking_ref varchar(30)`);
    await client.query(`ALTER TABLE folios ADD COLUMN IF NOT EXISTS bill_to_partner_id varchar(100)`);
    await client.query(`ALTER TABLE folios ADD COLUMN IF NOT EXISTS bill_to_label varchar(100)`);

    // 4. Alter payments.booking_id from UUID to varchar(50)
    console.log('Altering payments.booking_id to varchar(50)...');
    await client.query(`ALTER TABLE payments ALTER COLUMN booking_id TYPE varchar(50) USING booking_id::text`);

    // 5. Drop the bookings table
    console.log('Dropping bookings table...');
    await client.query('DROP TABLE IF EXISTS bookings CASCADE');

    // 6. Drop indexes on the old bookings table if they still exist
    console.log('Cleaning up old indexes...');
    await client.query('DROP INDEX IF EXISTS idx_bookings_status_check_in');
    await client.query('DROP INDEX IF EXISTS idx_bookings_room_check_in_check_out');
    await client.query('DROP INDEX IF EXISTS idx_bookings_customer_id');

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
