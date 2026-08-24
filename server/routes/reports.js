const express = require('express');
const db = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { startOfDay, startOfWeek, startOfMonth, addDays } = require('../utils/dates');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

async function aggregateFrom(fromIso) {
  const row = await db.get(
    `SELECT
      COALESCE(SUM(jami_summa), 0) AS tushum,
      COALESCE(SUM(jami_summa - jami_tannarx), 0) AS foyda,
      COALESCE(SUM(miqdor), 0) AS soni,
      COUNT(*) AS sotuvlar_soni
     FROM sales WHERE sana >= ?`,
    [fromIso]
  );
  return {
    tushum: row.tushum,
    foyda: row.foyda,
    soni: row.soni,
    sotuvlar_soni: row.sotuvlar_soni,
  };
}

// Bugungi, shu haftalik, shu oylik va hammasi vaqt bo'yicha umumiy ko'rsatkichlar
router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const [bugun, hafta, oy, hammasi] = await Promise.all([
      aggregateFrom(startOfDay(now).toISOString()),
      aggregateFrom(startOfWeek(now).toISOString()),
      aggregateFrom(startOfMonth(now).toISOString()),
      aggregateFrom('0000-01-01T00:00:00.000Z'),
    ]);
    res.json({ bugun, hafta, oy, hammasi });
  })
);

// Omborda hozir turgan mahsulotlarga sarflangan pul (xarid summasi) va potentsial foyda
router.get(
  '/inventory-value',
  asyncHandler(async (req, res) => {
    const row = await db.get(`
      SELECT
        COALESCE(SUM(tannarx * miqdor), 0) AS jami_xarid,
        COALESCE(SUM(sotish_narxi * miqdor), 0) AS potentsial_tushum,
        COALESCE(SUM((sotish_narxi - tannarx) * miqdor), 0) AS potentsial_foyda,
        COALESCE(SUM(miqdor), 0) AS jami_dona
      FROM products
    `);
    res.json(row);
  })
);

// Grafik uchun kunlik tushum (oxirgi N kun)
router.get(
  '/timeseries',
  asyncHandler(async (req, res) => {
    const kunlar = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const boshlanish = startOfDay(addDays(new Date(), -(kunlar - 1)));

    const rows = await db.all(
      `SELECT substr(sana, 1, 10) AS kun,
              SUM(jami_summa) AS tushum,
              SUM(jami_summa - jami_tannarx) AS foyda
       FROM sales
       WHERE sana >= ?
       GROUP BY kun
       ORDER BY kun ASC`,
      [boshlanish.toISOString()]
    );

    const byDay = new Map(rows.map((r) => [r.kun, r]));
    const natija = [];
    for (let i = 0; i < kunlar; i++) {
      const d = addDays(boshlanish, i);
      const key = d.toISOString().slice(0, 10);
      const found = byDay.get(key);
      natija.push({
        kun: key,
        tushum: found ? found.tushum : 0,
        foyda: found ? found.foyda : 0,
      });
    }
    res.json({ kunlik: natija });
  })
);

// Har bir sotuvchi qancha sotgani
router.get(
  '/by-seller',
  asyncHandler(async (req, res) => {
    const { period } = req.query;
    const now = new Date();
    let fromIso = null;
    if (period === 'today') fromIso = startOfDay(now).toISOString();
    else if (period === 'week') fromIso = startOfWeek(now).toISOString();
    else if (period === 'month') fromIso = startOfMonth(now).toISOString();

    const where = fromIso ? 'WHERE sana >= ?' : '';
    const params = fromIso ? [fromIso] : [];

    const rows = await db.all(
      `SELECT sotuvchi_id, sotuvchi_ismi,
              SUM(jami_summa) AS tushum,
              SUM(jami_summa - jami_tannarx) AS foyda,
              SUM(miqdor) AS soni,
              COUNT(*) AS sotuvlar_soni
       FROM sales ${where}
       GROUP BY sotuvchi_id
       ORDER BY tushum DESC`,
      params
    );

    res.json({ sotuvchilar: rows });
  })
);

// Eng ko'p sotilgan mahsulotlar
router.get(
  '/top-products',
  asyncHandler(async (req, res) => {
    const { period, sort } = req.query;
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
    const tartib = sort === 'foyda' ? 'foyda' : 'soni';
    const now = new Date();
    let fromIso = null;
    if (period === 'today') fromIso = startOfDay(now).toISOString();
    else if (period === 'week') fromIso = startOfWeek(now).toISOString();
    else if (period === 'month') fromIso = startOfMonth(now).toISOString();

    const where = fromIso ? 'WHERE sana >= ?' : '';
    const params = fromIso ? [fromIso] : [];

    const rows = await db.all(
      `SELECT mahsulot_nomi,
              SUM(miqdor) AS soni,
              SUM(jami_summa) AS tushum,
              SUM(jami_summa - jami_tannarx) AS foyda
       FROM sales ${where}
       GROUP BY mahsulot_nomi
       ORDER BY ${tartib} DESC
       LIMIT ?`,
      [...params, limit]
    );

    res.json({ mahsulotlar: rows });
  })
);

// Qoldig'i minimal chegaradan past bo'lgan mahsulotlar
router.get(
  '/low-stock',
  asyncHandler(async (req, res) => {
    const rows = await db.all('SELECT * FROM products WHERE miqdor <= min_miqdor ORDER BY miqdor ASC');
    res.json({ mahsulotlar: rows });
  })
);

module.exports = router;
