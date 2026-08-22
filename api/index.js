// Vercel uchun serverless kirish nuqtasi.
// Bu fayl faqat Express ilovasini (server/index.js) qayta eksport qiladi —
// Vercel har bir so'rovni shu funksiyaga yo'naltiradi (qarang: vercel.json).
module.exports = require('../server/index.js');
