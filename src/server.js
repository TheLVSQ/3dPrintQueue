const express = require('express');
const helmet = require('helmet');
const path = require('path');
const { randomUUID } = require('crypto');
const {
  listOrders,
  createOrder,
  updateOrderStatus,
  deleteOrder,
} = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

app.use(helmet());
app.use(express.json({ limit: '512kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const sanitizeOrder = (order) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  itemName: order.itemName,
  filamentType: order.filamentType,
  filamentColor: order.filamentColor,
  quantity: order.quantity,
  shipBy: order.shipBy,
  notes: order.notes || '',
  status: order.status,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.get('/api/orders', (req, res, next) => {
  try {
    const { status } = req.query;
    const orders = listOrders(status);
    res.json(orders.map(sanitizeOrder));
  } catch (err) {
    next(err);
  }
});

app.post('/api/orders', (req, res, next) => {
  try {
    const {
      orderNumber,
      itemName,
      filamentType,
      filamentColor,
      quantity,
      shipBy,
      notes = '',
    } = req.body || {};

    const missing = [];
    if (!orderNumber) missing.push('orderNumber');
    if (!itemName) missing.push('itemName');
    if (!filamentType) missing.push('filamentType');
    if (!filamentColor) missing.push('filamentColor');
    const numericQuantity = Number(quantity);
    if (!Number.isFinite(numericQuantity) || numericQuantity <= 0) missing.push('quantity');

    if (missing.length) {
      return res.status(400).json({
        error: `Missing or invalid fields: ${missing.join(', ')}`,
      });
    }

    const newOrder = createOrder({
      id: randomUUID(),
      orderNumber: String(orderNumber),
      itemName: String(itemName),
      filamentType: String(filamentType),
      filamentColor: String(filamentColor),
      quantity: numericQuantity,
      shipBy: toIsoOrNull(shipBy),
      notes: String(notes || ''),
      status: 'pending',
    });

    res.status(201).json(sanitizeOrder(newOrder));
  } catch (err) {
    next(err);
  }
});

app.patch('/api/orders/:id/status', (req, res, next) => {
  try {
    const { status } = req.body || {};
    const allowed = ['pending', 'completed', 'archived'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const updated = updateOrderStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(sanitizeOrder(updated));
  } catch (err) {
    next(err);
  }
});

app.delete('/api/orders/:id', (req, res, next) => {
  try {
    const removed = deleteOrder(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json(sanitizeOrder(removed));
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(PORT, () => {
  console.log(`3D Print Queue server running on http://localhost:${PORT}`);
});

