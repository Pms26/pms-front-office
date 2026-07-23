const { eq, gte, lt, and, asc } = require('drizzle-orm');
const db = require('../config/database');
const foliosTable = require('../schema/folios');
const folioItemsTable = require('../schema/folioItems');

exports.getDayInvoices = async (req, res) => {
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

    const closedFolios = await db
      .select()
      .from(foliosTable)
      .where(and(
        eq(foliosTable.status, 'closed'),
        gte(foliosTable.closedAt, startOfDay),
        lt(foliosTable.closedAt, endOfDay)
      ));

    const invoices = await Promise.all(
      closedFolios.map(async (folio) => {
        const items = await db
          .select()
          .from(folioItemsTable)
          .where(eq(folioItemsTable.folioId, folio.id))
          .orderBy(asc(folioItemsTable.date));

        return {
          folioId: folio.id,
          bookingId: folio.bookingId,
          bookingRef: folio.bookingRef || null,
          billToPartnerId: folio.billToPartnerId || null,
          billToLabel: folio.billToLabel || null,
          folioType: folio.folioType,
          label: folio.label,
          closedAt: folio.closedAt,
          totalAmount: items.reduce((sum, item) => sum + parseFloat(item.totalAmount), 0),
          items: items.map(item => ({
            id: item.id,
            description: item.description,
            category: item.category,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalAmount: item.totalAmount
          }))
        };
      })
    );

    res.json({
      date,
      count: invoices.length,
      totalAmount: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
      invoices
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
