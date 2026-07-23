const { eq, and, inArray, asc } = require('drizzle-orm');
const db = require('../config/database');
const foliosTable = require('../schema/folios');
const folioItemsTable = require('../schema/folioItems');

exports.getFolio = async (req, res) => {
  try {
    const { folioId } = req.params;

    const [folio] = await db
      .select()
      .from(foliosTable)
      .where(eq(foliosTable.id, folioId))
      .limit(1);

    if (!folio) {
      return res.status(404).json({ error: 'Folio introuvable' });
    }

    const allItems = await db
      .select()
      .from(folioItemsTable)
      .where(eq(folioItemsTable.folioId, folio.id))
      .orderBy(asc(folioItemsTable.date));

    const visibleItems = allItems.filter(item => item.isVisibleOnPrint);

    res.json({
      folio: {
        id: folio.id,
        type: folio.folioType,
        label: folio.label,
        status: folio.status,
        bookingId: folio.bookingId,
        totalAmount: allItems.reduce((sum, item) => sum + parseFloat(item.totalAmount), 0)
      },
      allItems: allItems.map(item => ({
        id: item.id,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
        taxRate: item.taxRate,
        isVisibleOnPrint: item.isVisibleOnPrint,
        date: item.date
      })),
      printableItems: visibleItems.map(item => ({
        id: item.id,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
        taxRate: item.taxRate,
        date: item.date
      })),
      printableTotal: visibleItems.reduce((sum, item) => sum + parseFloat(item.totalAmount), 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addItem = async (req, res) => {
  try {
    const { folioId } = req.params;
    const { description, category, quantity, unitPrice, taxRate } = req.body;

    const [folio] = await db
      .select()
      .from(foliosTable)
      .where(eq(foliosTable.id, folioId))
      .limit(1);

    if (!folio) {
      return res.status(404).json({ error: 'Folio introuvable' });
    }

    if (folio.status === 'closed') {
      return res.status(400).json({ error: 'Folio clôturé. Impossible d\'ajouter des prestations.' });
    }

    const totalAmount = quantity * unitPrice;

    const [item] = await db
      .insert(folioItemsTable)
      .values({
        folioId,
        description,
        category,
        quantity,
        unitPrice: String(unitPrice),
        totalAmount: String(totalAmount),
        taxRate: String(taxRate || 0),
        isVisibleOnPrint: true
      })
      .returning();

    const newTotal = parseFloat(folio.totalAmount) + totalAmount;
    await db
      .update(foliosTable)
      .set({ totalAmount: String(newTotal), updatedAt: new Date() })
      .where(eq(foliosTable.id, folioId));

    res.status(201).json({
      message: 'Prestation ajoutée avec succès',
      item: {
        id: item.id,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount
      },
      folioTotal: newTotal
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateItemVisibility = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { isVisible } = req.body;

    const [existing] = await db
      .select()
      .from(folioItemsTable)
      .where(eq(folioItemsTable.id, itemId))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: 'Prestation introuvable' });
    }

    const [updated] = await db
      .update(folioItemsTable)
      .set({ isVisibleOnPrint: isVisible, updatedAt: new Date() })
      .where(eq(folioItemsTable.id, itemId))
      .returning();

    res.json({
      message: 'Visibilité mise à jour',
      item: {
        id: updated.id,
        description: updated.description,
        isVisibleOnPrint: updated.isVisibleOnPrint
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.bulkUpdateVisibility = async (req, res) => {
  try {
    const { folioId } = req.params;
    const { itemIds, isVisible } = req.body;

    const [folio] = await db
      .select()
      .from(foliosTable)
      .where(eq(foliosTable.id, folioId))
      .limit(1);

    if (!folio) {
      return res.status(404).json({ error: 'Folio introuvable' });
    }

    await db
      .update(folioItemsTable)
      .set({ isVisibleOnPrint: isVisible, updatedAt: new Date() })
      .where(and(
        eq(folioItemsTable.folioId, folioId),
        inArray(folioItemsTable.id, itemIds)
      ));

    res.json({ message: 'Visibilité mise à jour pour les prestations sélectionnées' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const [item] = await db
      .select()
      .from(folioItemsTable)
      .where(eq(folioItemsTable.id, itemId))
      .limit(1);

    if (!item) {
      return res.status(404).json({ error: 'Prestation introuvable' });
    }

    const [folio] = await db
      .select()
      .from(foliosTable)
      .where(eq(foliosTable.id, item.folioId))
      .limit(1);

    if (folio.status === 'closed') {
      return res.status(400).json({ error: 'Folio clôturé. Impossible de supprimer.' });
    }

    const newTotal = parseFloat(folio.totalAmount) - parseFloat(item.totalAmount);
    await db
      .update(foliosTable)
      .set({ totalAmount: String(newTotal), updatedAt: new Date() })
      .where(eq(foliosTable.id, item.folioId));

    await db.delete(folioItemsTable).where(eq(folioItemsTable.id, itemId));

    res.json({
      message: 'Prestation supprimée',
      folioTotal: newTotal
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
