const express = require('express');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs/promises');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, '..', 'data', 'orders.json');

const toIsoOrNull = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

app.use(helmet());
app.use(express.json({ limit: '512kb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const ensureDataFile = async () => {
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, '[]', 'utf8');
  }
};

const readOrders = async () => {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  return JSON.parse(raw);
};

const writeOrders = async (orders) => {
  await fs.writeFile(DATA_FILE, JSON.stringify(orders, null, 2));
};

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

app.get('/api/orders', async (req, res, next) => {
  try {
    const { status } = req.query;
    const orders = await readOrders();
    const filtered = !status
      ? orders
      : orders.filter((order) => order.status === status.toLowerCase());

    filtered.sort((a, b) => {
      const shipA = a.shipBy ? new Date(a.shipBy).getTime() : Infinity;
      const shipB = b.shipBy ? new Date(b.shipBy).getTime() : Infinity;
      if (shipA === shipB) {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return shipA - shipB;
    });

    res.json(filtered.map(sanitizeOrder));
  } catch (err) {
    next(err);
  }
});

app.post('/api/orders', async (req, res, next) => {
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

    const newOrder = {
      id: randomUUID(),
      orderNumber: String(orderNumber),
      itemName: String(itemName),
      filamentType: String(filamentType),
      filamentColor: String(filamentColor),
      quantity: numericQuantity,
      shipBy: toIsoOrNull(shipBy),
      notes: String(notes || ''),
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const orders = await readOrders();
    orders.push(newOrder);
    await writeOrders(orders);

    res.status(201).json(sanitizeOrder(newOrder));
  } catch (err) {
    next(err);
  }
});

app.patch('/api/orders/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body || {};
    const allowed = ['pending', 'completed', 'archived'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${allowed.join(', ')}` });
    }

    const orders = await readOrders();
    const idx = orders.findIndex((order) => order.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }

    orders[idx].status = status;
    orders[idx].updatedAt = new Date().toISOString();
    await writeOrders(orders);

    res.json(sanitizeOrder(orders[idx]));
  } catch (err) {
    next(err);
  }
});

app.delete('/api/orders/:id', async (req, res, next) => {
  try {
    const orders = await readOrders();
    const idx = orders.findIndex((order) => order.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const [removed] = orders.splice(idx, 1);
    await writeOrders(orders);

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

