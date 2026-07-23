require('dotenv').config();
const { Pool } = require('pg');

const migrate = async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const hasColumn = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'bookings' AND column_name = 'market_segment_id'
      )
    `);

    if (!hasColumn.rows[0].exists) {
      await client.query(`
        ALTER TABLE "bookings" ADD COLUMN "market_segment_id" uuid
      `);

      await client.query(`
        UPDATE "bookings" b
        SET "market_segment_id" = ms."id"
        FROM "market_segments" ms
        WHERE b."market_segment" = ms."code"
      `);

      const hasOldColumn = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'bookings' AND column_name = 'market_segment'
        )
      `);

      if (hasOldColumn.rows[0].exists) {
        await client.query(`
          ALTER TABLE "bookings" ALTER COLUMN "market_segment_id" SET NOT NULL
        `);

        await client.query(`
          ALTER TABLE "bookings" DROP COLUMN "market_segment"
        `);
      }

      await client.query(`
        ALTER TABLE "bookings"
        ADD CONSTRAINT "bookings_market_segment_id_market_segments_id_fk"
        FOREIGN KEY ("market_segment_id") REFERENCES "market_segments"("id")
      `);

      console.log('Migration market_segment → market_segment_id terminée.');
    } else {
      console.log('Colonne market_segment_id déjà présente, migration ignorée.');
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

if (require.main === module) {
  migrate().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
} else {
  module.exports = migrate;
}
