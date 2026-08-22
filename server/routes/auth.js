const express = require('express');
const db = require('../db');
const { verifyPassword, signToken } = require('../utils/auth');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Qo'pol kuch (brute-force) hujumidan himoya: IP + login bo'yicha muvaffaqiyatsiz urinishlarni sanaydi
const MAX_URINISH = 5;
const BLOKLASH_MUDDATI_MS = 15 * 60 * 1000;
const urinishlar = new Map(); // key: "ip:login" -> { soni, blokGacha }

function loginKalit(req, login) {
  return `${req.ip}:${String(login).toLowerCase()}`;
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { login, parol } = req.body || {};
    if (!login || !parol) {
      return res.status(400).json({ xato: 'Login va parol kiritilishi shart' });
    }

    const kalit = loginKalit(req, login);
    const holat = urinishlar.get(kalit);
    const hozir = Date.now();

    if (holat && holat.blokGacha && holat.blokGacha > hozir) {
      const qoldiqDaqiqa = Math.ceil((holat.blokGacha - hozir) / 60000);
      return res.status(429).json({
        xato: `Ko'p marta noto'g'ri urinildi. ${qoldiqDaqiqa} daqiqadan so'ng qayta urinib ko'ring.`,
      });
    }

    const user = await db.get('SELECT * FROM users WHERE login = ?', [login]);

    if (!user || !verifyPassword(parol, user.parol_hash)) {
      const soni = (holat && holat.soni ? holat.soni : 0) + 1;
      const yangiHolat = { soni };
      if (soni >= MAX_URINISH) {
        yangiHolat.blokGacha = hozir + BLOKLASH_MUDDATI_MS;
        yangiHolat.soni = 0;
      }
      urinishlar.set(kalit, yangiHolat);
      return res.status(401).json({ xato: 'Login yoki parol noto\'g\'ri' });
    }

    urinishlar.delete(kalit);
    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, ism: user.ism, login: user.login, rol: user.rol },
    });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await db.get('SELECT id, ism, login, rol FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ xato: 'Foydalanuvchi topilmadi' });
    res.json({ user });
  })
);

module.exports = router;
