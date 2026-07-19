const { gte, lt, and } = require('drizzle-orm');
const db = require('../config/database');
const paymentsTable = require('../schema/payments');

exports.getDayPayments = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Le paramètre date est requis (format YYYY-MM-DD)' });
    }

    const startOfDay = new Date(`${date}T00:00:00.000Z`);
    const endOfDay = new Date(`${date}T23:59:59.999Z`);

    if (isNaN(startOfDay.getTime())) {
      return res.status(400).json({ error: 'Format de date invalide (attendu YYYY-MM-DD)' });
    }

    const payments = await db
      .select()
      .from(paymentsTable)
      .where(and(
        gte(paymentsTable.processedAt, startOfDay),
        lt(paymentsTable.processedAt, endOfDay)
      ));

    res.json({
      date,
      count: payments.length,
      totalAmount: payments.reduce((sum, p) => sum + parseFloat(p.amount), 0),
      payments: payments.map(p => ({
        id: p.id,
        bookingId: p.bookingId,
        folioId: p.folioId,
        amount: parseFloat(p.amount),
        paymentMethod: p.paymentMethod,
        reference: p.reference,
        processedAt: p.processedAt
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};