# Do'kon Nazorat Tizimi

Mahsulotlar, narxlar va kunlik/haftalik/oylik tushumlarni kuzatib boradigan
veb-ilova. Admin va sotuvchi uchun alohida panellar mavjud.

## Texnologiyalar

- **Backend:** Node.js + Express
- **Ma'lumotlar bazasi:** SQLite/libSQL — `@libsql/client` orqali. Lokal kompyuterda oddiy
  fayl sifatida (`data/dukon.db`) ishlaydi, hech qanday sozlash shart emas. Agar `.env` faylida
  `TURSO_DATABASE_URL` ko'rsatilsa, xuddi shu kod o'zgarishisiz [Turso](https://turso.tech)
  (bulutli SQLite) bazasiga ulanadi — bu **Vercel**ga joylashtirish uchun zarur (pastga qarang).
- **Frontend:** Oddiy HTML/CSS/JavaScript (build tizimi kerak emas), grafiklar uchun Chart.js (CDN)
- **Autentifikatsiya:** JWT (JSON Web Token)

## Talablar

- **Node.js 18.18 yoki undan yuqori versiya**
- Versiyani tekshirish: `node -v`

## O'rnatish va ishga tushirish

```bash
# 1. Loyiha papkasiga o'ting
cd DUKON

# 2. Paketlarni o'rnating (faqat express va jsonwebtoken — tez o'rnatiladi)
npm install

# 3. Ma'lumotlar bazasini yarating va boshlang'ich admin foydalanuvchini qo'shing
npm run seed

# 4. Serverni ishga tushiring
npm start
```

Server ishga tushgach, brauzerda oching: **http://localhost:3000**

Ishlab chiqish rejimida (fayllar o'zgarganda avtomatik qayta ishga tushish uchun):

```bash
npm run dev
```

## Boshlang'ich foydalanuvchilar (`npm run seed` orqali yaratiladi)

| Rol       | Login       | Parol         |
|-----------|-------------|---------------|
| Admin     | `admin`     | `admin123`    |
| Sotuvchi  | `sotuvchi1` | `sotuvchi123` |

> ⚠️ Production muhitida ishlatishdan oldin admin parolini albatta o'zgartiring.
> `.env` fayli allaqachon kuchli, tasodifiy `JWT_SECRET` bilan yaratilgan —
> agar boshqa muhitga (masalan production serverga) ko'chirsangiz, yangi
> serverda ham o'z `.env` faylini yarating (pastdagi "Serverga joylashtirish"
> bo'limiga qarang).

`npm run seed` skripti mavjud ma'lumotlarni o'chirmaydi — agar foydalanuvchilar
yoki mahsulotlar allaqachon mavjud bo'lsa, hech narsa qo'shmaydi. Shuning uchun
uni istalgan vaqt xavfsiz qayta ishga tushirish mumkin.

Server har safar ishga tushganda konsolga **xavfsizlik ogohlantirishlari**
chiqaradi (masalan, admin paroli hali standart bo'lsa) — shularga e'tibor bering.

## Loyiha tuzilishi

```
DUKON/
├── package.json
├── vercel.json              ← Vercelga joylashtirish konfiguratsiyasi
├── .env                     ← avtomatik yaratilgan, kuchli JWT_SECRET bilan (git'ga qo'shilmaydi)
├── .env.example             ← namuna, yangi muhitda .env yaratish uchun andoza
├── data/                    ← SQLite bazasi shu yerda avtomatik yaratiladi (lokal rejimda)
├── api/
│   └── index.js              ← Vercel serverless kirish nuqtasi (server/index.js'ni chaqiradi)
├── server/
│   ├── index.js             ← Express ilovasi (VPS'da tinglaydi, Vercelda faqat eksport qiladi)
│   ├── db.js                 ← libSQL ulanish (lokal fayl yoki Turso) va jadvallar sxemasi
│   ├── seed.js                ← Boshlang'ich admin/mahsulot ma'lumotlari
│   ├── utils/
│   │   ├── auth.js            ← parol hash (scrypt) + JWT
│   │   ├── asyncHandler.js     ← asinxron route xatoliklarini avtomatik ushlash
│   │   ├── csv.js              ← CSV export generatori
│   │   └── dates.js           ← kun/hafta/oy sanalarini hisoblash
│   ├── middleware/
│   │   └── auth.js            ← JWT tekshirish, rol nazorati
│   └── routes/
│       ├── auth.js            ← /api/auth/*  (login himoyasi shu yerda)
│       ├── users.js           ← /api/users/*  (faqat admin)
│       ├── products.js        ← /api/products/*
│       ├── categories.js       ← /api/categories/*
│       ├── sales.js           ← /api/sales/*  (jumladan /batch — savat orqali sotuv)
│       ├── reports.js         ← /api/reports/*  (faqat admin)
│       └── backup.js           ← /api/backup/download  (faqat admin)
└── public/
    ├── index.html              ← Login sahifasi
    ├── admin.html               ← Admin paneli
    ├── seller.html               ← Sotuvchi paneli
    ├── css/style.css              ← Responsive dizayn
    └── js/
        ├── api.js                 ← fetch wrapper, token boshqaruvi
        ├── login.js
        ├── admin.js                ← Dashboard, mahsulot/foydalanuvchi/kategoriya CRUD
        └── seller.js                ← Savat, sotuv, qidiruv, tarix, chek
```

## Imkoniyatlar

### Admin paneli
- Sotuvchilarni qo'shish / tahrirlash / o'chirish (login yaratish bilan)
- Mahsulotlarni to'liq boshqarish: nomi, tannarx, sotish narxi, qoldiq, kategoriya
- Dashboard: bugungi, haftalik, oylik tushum va foyda (raqam + grafik)
- Sotuvchilar bo'yicha hisobot (kim qancha sotgan)
- Eng ko'p sotilgan mahsulotlar reytingi
- Sof foyda hisob-kitobi (sotish narxi − tannarx)

### Sotuvchi paneli
- Mahsulotlarni ko'rish (rasmli kartochkalar), nomi bo'yicha tez qidirish va kategoriya bo'yicha filtrlash
  (faqat ko'rish, tahrirlab bo'lmaydi)
- **Savat:** bir nechta turdagi mahsulotni (turli kategoriyalardan) savatga yig'ib, bitta xaridorga
  bitta tranzaksiya sifatida sotish — "Sotuvni yakunlash" tugmasi bilan
- Har bir sotuvdan (yoki savat orqali yakunlangan sotuvdan) keyin **chek chop etish**
- O'zining kunlik/haftalik/oylik/tarixiy sotuvlari va tushumini ko'rish, CSV shaklida yuklab olish

### Qo'shimcha imkoniyatlar
- **Kategoriyalar:** mahsulotsiz ham yaratilishi mumkin (avval kategoriya, keyin ichiga mahsulot
  qo'shiladi), har biriga rasm yuklash yoki tayyor illyustratsiyalardan foydalanish, ichki guruhlarga
  bo'lish (masalan "Ruchkalar", "Matematika kitoblari")
- **Kam qoldiq ogohlantirishi:** har bir mahsulot uchun "min qoldiq" chegarasi belgilanadi (standart: 5).
  Qoldiq shu chegaradan pastga tushsa, admin dashboardida ogohlantirish banneri va alohida jadval chiqadi;
  sotuvchi panelida ham qizil belgi bilan ko'rsatiladi.
- **CSV (Excel) export:** admin mahsulotlar va barcha sotuvlar ro'yxatini, sotuvchi esa o'z sotuvlari
  tarixini CSV faylga yuklab olishi mumkin — fayl to'g'ridan-to'g'ri Excel'da ochiladi.
- **Butun bazani zaxiralash:** admin dashboardidan bir tugma bilan butun ma'lumotlar bazasini
  (`.db` fayl) yuklab olish mumkin.
- **Toast bildirishnomalar:** har bir amal (qo'shish/tahrirlash/o'chirish) natijasi ekranning pastki
  o'ng burchagida qisqa bildirishnoma sifatida ko'rsatiladi.

## Muhim texnik izohlar

- Har bir sotuv yozilganda mahsulotning o'sha paytdagi narxi va tannarxi
  "suratga olinadi" (snapshot) — shuning uchun keyinchalik narx o'zgarsa ham,
  eski sotuvlar hisobotlari to'g'ri qoladi.
- Sotuv yozilganda mahsulot qoldig'i avtomatik kamayadi; qoldiqdan ortiq
  miqdor sotib bo'lmaydi. Savat orqali bir nechta mahsulot birga sotilsa
  (`/api/sales/batch`), hammasi bitta tranzaksiya ichida amalga oshiriladi —
  birortasida xatolik bo'lsa, hech biri saqlanmaydi.
- Parollar hech qachon ochiq matnda saqlanmaydi — `crypto.scrypt` bilan
  tuz (salt) qo'shib xeshlanadi.
- Login sahifasi qo'pol kuch (brute-force) hujumidan himoyalangan: bir xil
  IP+login bo'yicha 5 marta xato parol kiritilsa, 15 daqiqaga bloklanadi.
- Barcha sahifalar mobil qurilmalarda ham qulay ishlaydi (responsive dizayn).

## Serverga joylashtirish (production)

Loyihani haqiqiy serverga (VPS, hosting) joylashtirishdan oldin quyidagilarni albatta bajaring:

1. **Node.js versiyasini tekshiring** — serverda ham Node.js 18.18+ o'rnatilgan bo'lishi shart (`node -v`).
2. **Yangi `.env` fayl yarating** — bu loyihada `.env` fayli allaqachon avtomatik yaratilgan va
   kuchli, tasodifiy `JWT_SECRET` bilan to'ldirilgan. Agar kodni boshqa serverga
   (masalan Git orqali, `.env` fayl ko'chirilmasdan) joylashtirsangiz, u yerda ham
   xuddi shunday tasodifiy qiymat bilan yangi `.env` yarating:
   ```bash
   cp .env.example .env
   node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(48).toString('hex'))" >> .env
   ```
   (yoki `.env` faylini ochib, `JWT_SECRET=...` qatorini qo'lda tasodifiy uzun qatorga almashtiring).
3. **Admin parolini o'zgartiring** — `admin` / `admin123` bilan kiring, "Sotuvchilar" bo'limida
   o'z profilingizni tahrirlab, yangi kuchli parol qo'ying. Server konsolida bu haqda
   ogohlantirish chiqib turadi, toki parolni o'zgartirmaguningizcha.
4. **Serverni doim ishlab turadigan qilib sozlang** — oddiy `npm start` terminal yopilsa
   to'xtaydi. Buning uchun jarayon menejeridan foydalaning, masalan
   [PM2](https://pm2.keymetrics.io/): `npm install -g pm2 && pm2 start npm --name dukon -- start`
   (yoki `pm2 start "node --env-file-if-exists=.env server/index.js" --name dukon`).
5. **Teskari proksi (nginx) ishlatsangiz** — HTTPS uchun tavsiya etiladi. `.env` fayliga
   `TRUST_PROXY=1` qo'shing, aks holda login himoyasi barcha foydalanuvchilarni bitta IP
   deb hisoblab, ularni bir-biriga bog'liq holda bloklab qo'yishi mumkin.
6. **Muntazam zaxira nusxa oling** — Admin panel → Dashboard → "💾 Bazani zaxiralash"
   tugmasi orqali butun `.db` faylini istalgan vaqt yuklab olish mumkin. Buni
   haftada kamida bir marta (yoki har kuni, savdo ko'p bo'lsa) qiling va faylni
   serverdan tashqarida (o'z kompyuteringiz, bulutli xotira) saqlang — agar server
   nosozligi yoki fayl buzilishi yuz bersa, faqat shu zaxira orqali tiklash mumkin.
7. **`data/` papkasini hech qachon `.gitignore`dan chiqarmang** — undagi `.db` fayl
   haqiqiy mijozlar/sotuvlar ma'lumotini saqlaydi, ochiq repozitoriyga tushib qolmasligi kerak.

## Vercelga joylashtirish (Turso bilan)

Vercel — **serverless** platforma: har bir so'rov vaqtinchalik muhitda ishlaydi, oddiy fayl
(`data/dukon.db`) doimiy saqlanmaydi. Shuning uchun Vercelga qo'yishdan oldin bazani
**Turso** (bulutli, SQLite bilan mos) xizmatiga ko'chirish shart. Kod bunga allaqachon
tayyor — faqat quyidagi qadamlarni bajarish kerak (bu qismlarni faqat siz, o'z hisobingiz
orqali qila olasiz):

1. **Turso hisobini oching va baza yarating** — [turso.tech](https://turso.tech) saytida
   ro'yxatdan o'ting (bepul tarifi yetarli). So'ng Turso CLI orqali:
   ```bash
   npm install -g @tursodatabase/cli   # yoki turso.tech'dagi o'rnatish yo'riqnomasi
   turso auth login
   turso db create dukon-nazorat
   turso db show dukon-nazorat --url          # -> TURSO_DATABASE_URL qiymati
   turso db tokens create dukon-nazorat        # -> TURSO_AUTH_TOKEN qiymati
   ```
2. **Vercel hisobini oching va loyihani ulang** — [vercel.com](https://vercel.com) da
   ro'yxatdan o'ting, GitHub repozitoriyangizni (yoki loyiha papkasini Vercel CLI orqali
   `vercel` buyrug'i bilan) ulang.
3. **Muhit o'zgaruvchilarini Vercel loyihasi sozlamalarida kiriting** (Project Settings →
   Environment Variables):
   - `JWT_SECRET` — `.env` faylingizdagi qiymatning aynan o'zi (yoki yangi tasodifiy qiymat)
   - `TURSO_DATABASE_URL` — 1-qadamda olingan qiymat
   - `TURSO_AUTH_TOKEN` — 1-qadamda olingan qiymat
4. **Joylashtiring** — `vercel --prod` (yoki GitHub'ga push qilsangiz, Vercel avtomatik
   joylashtiradi, chunki loyihada `vercel.json` va `api/index.js` allaqachon tayyor).
5. **Boshlang'ich ma'lumotlarni yarating** — birinchi marta joylashtirgandan so'ng, lokal
   kompyuteringizda quyidagini ishga tushiring (bu Turso bazasiga ulanib, admin va namuna
   ma'lumotlarni yaratadi):
   ```bash
   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run seed
   ```
   (Windows PowerShell'da: `$env:TURSO_DATABASE_URL="..."; $env:TURSO_AUTH_TOKEN="..."; npm run seed`)
6. **Zaxira nusxa** — Turso rejimida "💾 Bazani zaxiralash" tugmasi `.db` fayl o'rniga
   barcha jadvallarni o'z ichiga olgan `.json` fayl beradi (chunki Turso'da alohida fayl
   mavjud emas). Bundan tashqari, Turso'ning o'zida ham avtomatik zaxira/branch imkoniyati bor
   (`turso db shell dukon-nazorat` yoki Turso dashboard orqali).

> ⚠️ Vercelning bepul tarifida serverless funksiya "sovuq boshlanish"i sekinroq bo'lishi
> mumkin (birinchi so'rovda bazaga ulanish + migratsiya tekshiruvi ishga tushadi). Doimiy
> yuqori tezlik kerak bo'lsa, VPS/Railway/Render hamon soddaroq va tezroq yechim.

## Muammolarni bartaraf etish

- **Portni band deb yozsa:** `.env` faylida `PORT` qiymatini o'zgartiring
  (masalan `PORT=4000`) yoki 3000-portni band qilgan dasturni to'xtating.
- **Ma'lumotlar bazasini boshidan boshlash kerak bo'lsa:** `data/dukon.db`
  faylini o'chirib, `npm run seed` ni qayta ishga tushiring.
