const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'orders.db');
const LEGACY_JSON = path.join(DATA_DIR, 'orders.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    orderNumber TEXT NOT NULL,
    itemName TEXT NOT NULL,
    filamentType TEXT NOT NULL,
    filamentColor TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    shipBy TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  CREATE INDEX IF NOT EXISTS idx_orders_shipBy ON orders(shipBy);
`);

const baseSelect = `
  SELECT id,
         orderNumber,
         itemName,
         filamentType,
         filamentColor,
         quantity,
         shipBy,
         notes,
         status,
         createdAt,
         updatedAt
  FROM orders
`;

const orderClause = `
  ORDER BY
    CASE WHEN shipBy IS NULL THEN 1 ELSE 0 END,
    shipBy,
    createdAt
`;

const selectAllStmt = db.prepare(`${baseSelect} ${orderClause}`);
const selectByStatusStmt = db.prepare(`${baseSelect} WHERE status = ? ${orderClause}`);
const selectByIdStmt = db.prepare(`${baseSelect} WHERE id = ?`);
const insertStmt = db.prepare(`
  INSERT INTO orders (
    id,
    orderNumber,
    itemName,
    filamentType,
    filamentColor,
    quantity,
    shipBy,
    notes,
    status,
    createdAt,
    updatedAt
  ) VALUES (
    @id,
    @orderNumber,
    @itemName,
    @filamentType,
    @filamentColor,
    @quantity,
    @shipBy,
    @notes,
    @status,
    @createdAt,
    @updatedAt
  )
`);
const updateStatusStmt = db.prepare(`
  UPDATE orders
  SET status = ?,
      updatedAt = ?
  WHERE id = ?
`);
const deleteStmt = db.prepare(`
  DELETE FROM orders
  WHERE id = ?
`);

const migrateLegacyJson = () => {
  if (!fs.existsSync(LEGACY_JSON)) {
    return;
  }

  const { total } = db.prepare('SELECT COUNT(1) as total FROM orders').get();
  if (total > 0) {
    return;
  }

  try {
    const payload = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf8'));
    if (!Array.isArray(payload) || payload.length === 0) {
      return;
    }

    const normalized = payload.map((entry) => ({
      id: entry.id || randomUUID(),
      orderNumber: entry.orderNumber ? String(entry.orderNumber) : 'UNKNOWN',
      itemName: entry.itemName ? String(entry.itemName) : 'UNKNOWN ITEM',
      filamentType: entry.filamentType ? String(entry.filamentType) : 'unknown',
      filamentColor: entry.filamentColor ? String(entry.filamentColor) : 'unknown',
      quantity: Number(entry.quantity) || 1,
      shipBy: entry.shipBy || null,
      notes: entry.notes ? String(entry.notes) : '',
      status: (entry.status || 'pending').toLowerCase(),
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: entry.updatedAt || new Date().toISOString(),
    }));

    const transaction = db.transaction((rows) => {
      rows.forEach((row) => insertStmt.run(row));
    });
    transaction(normalized);

    const backupPath = `${LEGACY_JSON}.bak`;
    fs.renameSync(LEGACY_JSON, backupPath);
    console.log(`Migrated ${normalized.length} legacy JSON orders to SQLite. Backup saved to ${path.basename(backupPath)}`);
  } catch (err) {
    console.error('Failed to migrate legacy orders.json to SQLite:', err);
  }
};

migrateLegacyJson();

const listOrders = (status) => {
  if (status) {
    return selectByStatusStmt.all(status.toLowerCase());
  }
  return selectAllStmt.all();
};

const getOrderById = (id) => selectByIdStmt.get(id);

const createOrder = (order) => {
  const timestamp = new Date().toISOString();
  const record = {
    ...order,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  insertStmt.run(record);
  return record;
};

const updateOrderStatus = (id, status) => {
  const updatedAt = new Date().toISOString();
  const result = updateStatusStmt.run(status, updatedAt, id);
  if (!result.changes) {
    return null;
  }
  return getOrderById(id);
};

const deleteOrder = (id) => {
  const existing = getOrderById(id);
  if (!existing) {
    return null;
  }
  deleteStmt.run(id);
  return existing;
};

module.exports = {
  listOrders,
  getOrderById,
  createOrder,
  updateOrderStatus,
  deleteOrder,
};
