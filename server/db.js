const path = require('node:path');
const fs = require('node:fs');
const { createClient } = require('@libsql/client');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'dukon.db');
const isRemote = Boolean(process.env.TURSO_DATABASE_URL);

const client = isRemote
  ? createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : createClient({ url: `file:${dbPath}` });

client.dbPath = dbPath;
client.isRemote = isRemote;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ism TEXT NOT NULL,
    login TEXT NOT NULL UNIQUE,
    parol_hash TEXT NOT NULL,
    rol TEXT NOT NULL CHECK (rol IN ('admin', 'sotuvchi')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nomi TEXT NOT NULL,
    tannarx REAL NOT NULL,
    sotish_narxi REAL NOT NULL,
    miqdor INTEGER NOT NULL DEFAULT 0,
    kategoriya TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nomi TEXT NOT NULL UNIQUE,
    icon TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER,
    mahsulot_nomi TEXT NOT NULL,
    sotuvchi_id INTEGER NOT NULL,
    sotuvchi_ismi TEXT NOT NULL,
    miqdor INTEGER NOT NULL,
    narx_dona REAL NOT NULL,
    tannarx_dona REAL NOT NULL,
    jami_summa REAL NOT NULL,
    jami_tannarx REAL NOT NULL,
    sana TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
    FOREIGN KEY (sotuvchi_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_sales_sana ON sales(sana);
  CREATE INDEX IF NOT EXISTS idx_sales_sotuvchi ON sales(sotuvchi_id);
  CREATE INDEX IF NOT EXISTS idx_products_nomi ON products(nomi);
`;

async function ensureColumn(table, column, definition) {
  const cols = await client.execute(`PRAGMA table_info(${table})`);
  if (!cols.rows.some((c) => c.name === column)) {
    await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

let migrated = null;

async function migrate() {
  await client.executeMultiple(SCHEMA);

  await ensureColumn('products', 'min_miqdor', 'INTEGER NOT NULL DEFAULT 5');
  await ensureColumn('products', 'rasm', 'TEXT');
  await ensureColumn('products', 'ichki_guruh', 'TEXT');
  await ensureColumn('categories', 'rasm', 'TEXT');
  await ensureColumn('sales', 'buyurtma_id', 'TEXT');

  // Mahsulotlarda ishlatilgan, lekin categories jadvalida hali yo'q nomlarni ko'chirib qo'yish
  await client.execute(`
    INSERT OR IGNORE INTO categories (nomi)
    SELECT DISTINCT kategoriya FROM products
    WHERE kategoriya IS NOT NULL AND kategoriya != ''
  `);
}

// Har bir "sovuq boshlanish"da (server yoki serverless funksiya birinchi so'rovda) faqat bir marta ishga tushadi
function ensureMigrated() {
  if (!migrated) {
    migrated = migrate();
  }
  return migrated;
}

client.ensureMigrated = ensureMigrated;

// node:sqlite'ning prepare().get()/.all()/.run() uslubiga o'xshash qulay yordamchilar
client.get = async (sql, args = []) => (await client.execute({ sql, args })).rows[0];
client.all = async (sql, args = []) => (await client.execute({ sql, args })).rows;
client.run = async (sql, args = []) => {
  const r = await client.execute({ sql, args });
  return { lastInsertRowid: Number(r.lastInsertRowid ?? 0), changes: r.rowsAffected };
};

module.exports = client;
