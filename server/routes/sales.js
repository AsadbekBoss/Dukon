const express = require('express');
const crypto = require('node:crypto');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { startOfDay, startOfWeek, startOfMonth } = require('../utils/dates');
const { sendCsv } = require('../utils/csv');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth);

// Sotuvchi yangi sotuv yozadi
router.post(
  '/',
  requireRole('sotuvchi'),
  asyncHandler(async (req, res) => {
    const { product_id, miqdor } = req.body || {};
    const pid = Number(product_id);
    const mq = Number(miqdor);

    if (!pid || !mq || mq <= 0) {
      return res.status(400).json({ xato: 'Mahsulot va miqdor to\'g\'ri kiritilishi shart' });
    }

    const product = await db.get('SELECT * FROM products WHERE id = ?', [pid]);
    if (!product) return res.status(404).json({ xato: 'Mahsulot topilmadi' });
    if (product.miqdor < mq) {
      return res.status(400).json({ xato: `Omborda yetarli mahsulot yo'q (qoldiq: ${product.miqdor})` });
    }

    const jamiSumma = mq * product.sotish_narxi;
    const jamiTannarx = mq * product.tannarx;
    const sana = new Date().toISOString();

    const tx = await db.transaction('write');
    try {
      await tx.execute({ sql: 'UPDATE products SET miqdor = miqdor - ? WHERE id = ?', args: [mq, pid] });
      const info = await tx.execute({
        sql: `INSERT INTO sales
          (product_id, mahsulot_nomi, sotuvchi_id, sotuvchi_ismi, miqdor, narx_dona, tannarx_dona, jami_summa, jami_tannarx, sana)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [pid, product.nomi, req.user.id, req.user.ism, mq, product.sotish_narxi, product.tannarx, jamiSumma, jamiTannarx, sana],
      });
      await tx.commit();
      const sale = await db.get('SELECT * FROM sales WHERE id = ?', [Number(info.lastInsertRowid)]);
      res.status(201).json({ sale });
    } catch (err) {
      await tx.rollback();
      res.status(500).json({ xato: 'Sotuvni saqlashda xatolik yuz berdi' });
    }
  })
);

// Sotuvchi savatdagi bir nechta mahsulotni bitta xaridorga birgalikda sotadi
router.post(
  '/batch',
  requireRole('sotuvchi'),
  asyncHandler(async (req, res) => {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ xato: "Savat bo'sh" });
    }

    const parsed = [];
    for (const it of items) {
      const pid = Number(it && it.product_id);
      const mq = Number(it && it.miqdor);
      if (!pid || !mq || mq <= 0) {
        return res.status(400).json({ xato: 'Savatdagi mahsulot yoki miqdor noto\'g\'ri' });
      }
      const product = await db.get('SELECT * FROM products WHERE id = ?', [pid]);
      if (!product) return res.status(404).json({ xato: `Mahsulot topilmadi (id: ${pid})` });
      if (product.miqdor < mq) {
        return res.status(400).json({ xato: `"${product.nomi}" uchun omborda yetarli mahsulot yo'q (qoldiq: ${product.miqdor})` });
      }
      parsed.push({ product, mq });
    }

    const buyurtmaId = crypto.randomUUID();
    const sana = new Date().toISOString();

    const tx = await db.transaction('write');
    try {
      const createdIds = [];
      for (const { product, mq } of parsed) {
        await tx.execute({ sql: 'UPDATE products SET miqdor = miqdor - ? WHERE id = ?', args: [mq, product.id] });
        const jamiSumma = mq * product.sotish_narxi;
        const jamiTannarx = mq * product.tannarx;
        const info = await tx.execute({
          sql: `INSERT INTO sales
            (product_id, mahsulot_nomi, sotuvchi_id, sotuvchi_ismi, miqdor, narx_dona, tannarx_dona, jami_summa, jami_tannarx, sana, buyurtma_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            product.id,
            product.nomi,
            req.user.id,
            req.user.ism,
            mq,
            product.sotish_narxi,
            product.tannarx,
            jamiSumma,
            jamiTannarx,
            sana,
            buyurtmaId,
          ],
        });
        createdIds.push(Number(info.lastInsertRowid));
      }
      await tx.commit();

      const created = await db.all(
        `SELECT * FROM sales WHERE id IN (${createdIds.map(() => '?').join(',')}) ORDER BY id ASC`,
        createdIds
      );
      const jami = created.reduce((s, r) => s + r.jami_summa, 0);
      res.status(201).json({ sales: created, jami_summa: jami, buyurtma_id: buyurtmaId });
    } catch (err) {
      await tx.rollback();
      res.status(500).json({ xato: 'Sotuvni saqlashda xatolik yuz berdi' });
    }
  })
);

function periodBounds(period) {
  const now = new Date();
  if (period === 'today') return { from: startOfDay(now) };
  if (period === 'week') return { from: startOfWeek(now) };
  if (period === 'month') return { from: startOfMonth(now) };
  return null;
}

// Sotuvchi o'z sotuvlarini ko'radi
router.get(
  '/mine',
  requireRole('sotuvchi'),
  asyncHandler(async (req, res) => {
    const { period, from, to } = req.query;
    let sales;
    const bounds = periodBounds(period);

    if (from || to) {
      const fromIso = from ? new Date(from).toISOString() : '0000-01-01T00:00:00.000Z';
      const toIso = to ? new Date(to).toISOString() : '9999-12-31T23:59:59.999Z';
      sales = await db.all('SELECT * FROM sales WHERE sotuvchi_id = ? AND sana >= ? AND sana <= ? ORDER BY sana DESC', [
        req.user.id,
        fromIso,
        toIso,
      ]);
    } else if (bounds) {
      sales = await db.all('SELECT * FROM sales WHERE sotuvchi_id = ? AND sana >= ? ORDER BY sana DESC', [
        req.user.id,
        bounds.from.toISOString(),
      ]);
    } else {
      sales = await db.all('SELECT * FROM sales WHERE sotuvchi_id = ? ORDER BY sana DESC LIMIT 200', [req.user.id]);
    }

    const jami = sales.reduce((s, r) => s + r.jami_summa, 0);
    res.json({ sales, jami_summa: jami, soni: sales.length });
  })
);

// Admin barcha sotuvlarni ko'radi (filtrlar bilan)
router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { sotuvchi_id, from, to } = req.query;
    const shartlar = [];
    const params = [];

    if (sotuvchi_id) {
      shartlar.push('sotuvchi_id = ?');
      params.push(Number(sotuvchi_id));
    }
    if (from) {
      shartlar.push('sana >= ?');
      params.push(new Date(from).toISOString());
    }
    if (to) {
      shartlar.push('sana <= ?');
      params.push(new Date(to).toISOString());
    }

    const where = shartlar.length ? `WHERE ${shartlar.join(' AND ')}` : '';
    const sales = await db.all(`SELECT * FROM sales ${where} ORDER BY sana DESC LIMIT 500`, params);

    const jami = sales.reduce((s, r) => s + r.jami_summa, 0);
    res.json({ sales, jami_summa: jami, soni: sales.length });
  })
);

function salesToCsvRows(sales) {
  const headers = ['Sana', 'Mahsulot', 'Sotuvchi', 'Miqdor', 'Narx/dona', 'Jami summa', 'Jami tannarx', 'Foyda'];
  const rows = sales.map((s) => [
    s.sana,
    s.mahsulot_nomi,
    s.sotuvchi_ismi,
    s.miqdor,
    s.narx_dona,
    s.jami_summa,
    s.jami_tannarx,
    s.jami_summa - s.jami_tannarx,
  ]);
  return { headers, rows };
}

// Sotuvchi o'z sotuvlarini CSV shaklida yuklab oladi
router.get(
  '/mine/export/csv',
  requireRole('sotuvchi'),
  asyncHandler(async (req, res) => {
    const { period } = req.query;
    const bounds = periodBounds(period);
    const sales = bounds
      ? await db.all('SELECT * FROM sales WHERE sotuvchi_id = ? AND sana >= ? ORDER BY sana DESC', [
          req.user.id,
          bounds.from.toISOString(),
        ])
      : await db.all('SELECT * FROM sales WHERE sotuvchi_id = ? ORDER BY sana DESC', [req.user.id]);

    const { headers, rows } = salesToCsvRows(sales);
    sendCsv(res, 'mening-sotuvlarim.csv', headers, rows);
  })
);

// Admin barcha sotuvlarni CSV shaklida yuklab oladi
router.get(
  '/export/csv',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { sotuvchi_id, from, to } = req.query;
    const shartlar = [];
    const params = [];

    if (sotuvchi_id) {
      shartlar.push('sotuvchi_id = ?');
      params.push(Number(sotuvchi_id));
    }
    if (from) {
      shartlar.push('sana >= ?');
      params.push(new Date(from).toISOString());
    }
    if (to) {
      shartlar.push('sana <= ?');
      params.push(new Date(to).toISOString());
    }

    const where = shartlar.length ? `WHERE ${shartlar.join(' AND ')}` : '';
    const sales = await db.all(`SELECT * FROM sales ${where} ORDER BY sana DESC`, params);

    const { headers, rows } = salesToCsvRows(sales);
    sendCsv(res, 'sotuvlar.csv', headers, rows);
  })
);

module.exports = router;
