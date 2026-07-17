const Folio = require('../models/Folio');
const FolioItem = require('../models/FolioItem');
const Booking = require('../models/Booking');

exports.getFolio = async (req, res) => {
  try {
    const { folioId } = req.params;

    const folio = await Folio.findById(folioId).populate('bookingId');
    if (!folio) {
      return res.status(404).json({ error: 'Folio introuvable' });
    }

    const allItems = await FolioItem.find({ folioId: folio._id }).sort({ date: 1 });

    const visibleItems = allItems.filter(item => item.isVisibleOnPrint);

    res.json({
      folio: {
        id: folio._id,
        type: folio.folioType,
        label: folio.label,
        status: folio.status,
        bookingId: folio.bookingId._id,
        totalAmount: allItems.reduce((sum, item) => sum + item.totalAmount, 0)
      },
      allItems: allItems.map(item => ({
        id: item._id,
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
        id: item._id,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount,
        taxRate: item.taxRate,
        date: item.date
      })),
      printableTotal: visibleItems.reduce((sum, item) => sum + item.totalAmount, 0)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addItem = async (req, res) => {
  try {
    const { folioId } = req.params;
    const { description, category, quantity, unitPrice, taxRate } = req.body;

    const folio = await Folio.findById(folioId);
    if (!folio) {
      return res.status(404).json({ error: 'Folio introuvable' });
    }

    if (folio.status === 'closed') {
      return res.status(400).json({ error: 'Folio clôturé. Impossible d\'ajouter des prestations.' });
    }

    const totalAmount = quantity * unitPrice;

    const item = await FolioItem.create({
      folioId,
      description,
      category,
      quantity,
      unitPrice,
      totalAmount,
      taxRate: taxRate || 0,
      isVisibleOnPrint: true,
      addedBy: req.user?.id || null
    });

    folio.totalAmount += totalAmount;
    await folio.save();

    res.status(201).json({
      message: 'Prestation ajoutée avec succès',
      item: {
        id: item._id,
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalAmount: item.totalAmount
      },
      folioTotal: folio.totalAmount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateItemVisibility = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { isVisible } = req.body;

    const item = await FolioItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Prestation introuvable' });
    }

    item.isVisibleOnPrint = isVisible;
    await item.save();

    res.json({
      message: 'Visibilité mise à jour',
      item: {
        id: item._id,
        description: item.description,
        isVisibleOnPrint: item.isVisibleOnPrint
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

    const folio = await Folio.findById(folioId);
    if (!folio) {
      return res.status(404).json({ error: 'Folio introuvable' });
    }

    await FolioItem.updateMany(
      { folioId, _id: { $in: itemIds } },
      { $set: { isVisibleOnPrint: isVisible } }
    );

    res.json({ message: 'Visibilité mise à jour pour les prestations sélectionnées' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await FolioItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ error: 'Prestation introuvable' });
    }

    const folio = await Folio.findById(item.folioId);
    if (folio.status === 'closed') {
      return res.status(400).json({ error: 'Folio clôturé. Impossible de supprimer.' });
    }

    folio.totalAmount -= item.totalAmount;
    await folio.save();

    await FolioItem.findByIdAndDelete(itemId);

    res.json({
      message: 'Prestation supprimée',
      folioTotal: folio.totalAmount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
