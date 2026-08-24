const db = require('./db');
const { hashPassword } = require('./utils/auth');

async function seed() {
  await db.ensureMigrated();

  const devSoni = (await db.get("SELECT COUNT(*) AS soni FROM users WHERE rol = 'dev'")).soni;
  if (devSoni === 0) {
    await db.run('INSERT INTO users (ism, login, parol_hash, rol) VALUES (?, ?, ?, ?)', [
      'Tizim egasi',
      'dev',
      hashPassword('dev12345'),
      'dev',
    ]);
    console.log('✔ Dev foydalanuvchi yaratildi -> login: dev, parol: dev12345');
  } else {
    console.log('ℹ Dev foydalanuvchi allaqachon mavjud.');
  }

  const oddiyUserSoni = (await db.get("SELECT COUNT(*) AS soni FROM users WHERE rol != 'dev'")).soni;

  if (oddiyUserSoni === 0) {
    await db.run('INSERT INTO users (ism, login, parol_hash, rol) VALUES (?, ?, ?, ?)', [
      'Administrator',
      'admin',
      hashPassword('admin123'),
      'admin',
    ]);
    console.log('✔ Admin foydalanuvchi yaratildi -> login: admin, parol: admin123');

    await db.run('INSERT INTO users (ism, login, parol_hash, rol) VALUES (?, ?, ?, ?)', [
      'Aziz Sotuvchi',
      'sotuvchi1',
      hashPassword('sotuvchi123'),
      'sotuvchi',
    ]);
    console.log('✔ Namuna sotuvchi yaratildi -> login: sotuvchi1, parol: sotuvchi123');
  } else {
    console.log('ℹ Foydalanuvchilar allaqachon mavjud, admin yaratilmadi.');
  }

  const productSoni = (await db.get('SELECT COUNT(*) AS soni FROM products')).soni;
  if (productSoni === 0) {
    const namunalar = [
      // [nomi, tannarx, sotish_narxi, miqdor, kategoriya]
      ['Daftar 48 varaq', 2000, 3000, 100, 'Maktab buyumlari'],
      ['Ruchka (ko\'k)', 1000, 2000, 150, 'Maktab buyumlari'],
      ['Qalam to\'plami (12 dona)', 8000, 12000, 40, 'Maktab buyumlari'],
      ['Rangli qalamlar (24 rang)', 15000, 22000, 30, 'Bog\'cha buyumlari'],
      ['Plastilin to\'plami', 10000, 15000, 35, 'Bog\'cha buyumlari'],
      ['Albom qog\'ozi', 4000, 6000, 50, 'Bog\'cha buyumlari'],
      ['Ertaklar to\'plami (bolalar uchun)', 18000, 26000, 20, 'Badiy kitoblar'],
      ['"Alpomish" dostoni', 20000, 29000, 15, 'Badiy kitoblar'],
      ['Matematika masalalar to\'plami', 22000, 32000, 25, 'Repetitor uchun materiallar'],
      ['Ingliz tili grammatika qo\'llanmasi', 30000, 42000, 18, 'Repetitor uchun materiallar'],
      ['Maktab sumkasi (o\'g\'il bolalar)', 65000, 95000, 20, 'Sumkalar'],
      ['Bog\'cha ryukzagi (rangli)', 45000, 68000, 25, 'Sumkalar'],
    ];
    for (const p of namunalar) {
      await db.run('INSERT INTO products (nomi, tannarx, sotish_narxi, miqdor, kategoriya) VALUES (?, ?, ?, ?, ?)', p);
    }
    console.log(`✔ ${namunalar.length} ta namuna mahsulot qo'shildi`);
  } else {
    console.log('ℹ Mahsulotlar allaqachon mavjud, namuna qo\'shilmadi.');
  }

  console.log('\nSeed jarayoni tugadi.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed jarayonida xatolik:', err);
    process.exit(1);
  });
