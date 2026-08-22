const path = require('node:path');
const express = require('express');

const db = require('./db');
const { verifyPassword } = require('./utils/auth');
const asyncHandler = require('./utils/asyncHandler');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const salesRoutes = require('./routes/sales');
const reportRoutes = require('./routes/reports');
const backupRoutes = require('./routes/backup');

const app = express();
const PORT = process.env.PORT || 3000;

// Nginx/Apache kabi teskari proksi ortida ishga tushirilsa, haqiqiy mijoz IP manzilini
// aniqlash uchun (login himoyasi shunga tayanadi). .env faylida TRUST_PROXY=1 qo'ying.
if (process.env.TRUST_PROXY) {
  app.set('trust proxy', 1);
}

// Mahsulot rasmlari base64 shaklida yuboriladi, shuning uchun limit oshirilgan
app.use(express.json({ limit: '8mb' }));

// Jadvallar/migratsiyalar birinchi so'rovda (yoki "sovuq boshlanish"da) bir marta tayyorlanadi
app.use(
  asyncHandler(async (req, res, next) => {
    await db.ensureMigrated();
    next();
  })
);

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/backup', backupRoutes);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res) => {
  res.status(404).json({ xato: 'Sahifa yoki API topilmadi' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (!res.headersSent) {
    res.status(500).json({ xato: 'Serverda kutilmagan xatolik yuz berdi' });
  }
});

async function xavfsizlikOgohlantirishlari() {
  const ogohlantirishlar = [];

  if (!process.env.JWT_SECRET) {
    ogohlantirishlar.push(
      "JWT_SECRET .env faylida o'rnatilmagan — standart (nofaol) qiymat ishlatilmoqda. Production uchun .env faylida kuchli JWT_SECRET belgilang."
    );
  }

  await db.ensureMigrated();
  const admin = await db.get("SELECT * FROM users WHERE rol = 'admin' ORDER BY id ASC LIMIT 1");
  if (admin && verifyPassword('admin123', admin.parol_hash)) {
    ogohlantirishlar.push(
      `Admin foydalanuvchi ("${admin.login}") hali ham standart "admin123" parolidan foydalanmoqda — uni albatta o'zgartiring (Sotuvchilar bo'limi > Tahrirlash).`
    );
  }

  if (ogohlantirishlar.length) {
    console.log('\n⚠️  XAVFSIZLIK OGOHLANTIRISHI:');
    ogohlantirishlar.forEach((x) => console.log('   - ' + x));
    console.log('');
  }
}

// Vercel kabi serverless muhitda bu fayl faqat Express ilovasini eksport qiladi
// (tashqi wrapper — api/index.js — so'rovlarni shunga uzatadi). Oddiy serverda esa
// (VPS, lokal kompyuter) an'anaviy tarzda portni tinglaydi.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Do'kon nazorat tizimi ishga tushdi: http://localhost:${PORT}`);
    xavfsizlikOgohlantirishlari().catch((err) => console.error('Ogohlantirishlarni tekshirishda xatolik:', err));
  });
}

module.exports = app;
