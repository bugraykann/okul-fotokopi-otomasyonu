const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'fotokopi.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Veritabanı bağlantı hatası:', err.message);
  } else {
    console.log('SQLite veritabanına bağlandı:', dbPath);
  }
});

// Tabloları oluştur
db.serialize(() => {
  // Kullanıcılar tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL, -- 'ogretmen', 'mudur', 'bilgi_islem', 'admin'
      kademe TEXT,         -- 'Anaokulu', 'İlkokul', 'Ortaokul', 'Lise'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Baskı/Fotokopi Talepleri tablosu
  db.run(`
    CREATE TABLE IF NOT EXISTS print_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      teacher_name TEXT NOT NULL,
      teacher_email TEXT NOT NULL,
      kademe TEXT NOT NULL,
      file_original_name TEXT NOT NULL,
      file_saved_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      copy_count INTEGER NOT NULL DEFAULT 1,
      color_mode TEXT NOT NULL DEFAULT 'SB',      -- 'SB' (Siyah-Beyaz), 'Renkli'
      duplex_mode TEXT NOT NULL DEFAULT 'Tek',    -- 'Tek' (Tek Yönlü), 'Cift' (Arkalı-Önlü)
      pages_per_sheet INTEGER NOT NULL DEFAULT 1, -- 1, 2, 4
      paper_size TEXT NOT NULL DEFAULT 'A4',      -- 'A4', 'A3'
      note TEXT,
      status TEXT NOT NULL DEFAULT 'beklemede',   -- 'beklemede', 'onaylandi', 'tamamlandi', 'reddedildi'
      rejection_reason TEXT,
      approved_by TEXT,
      approved_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Başlangıç kullanıcılarını ekle (Eğer yoksa)
  const defaultUsers = [
    { name: 'Bilgi İşlem Yetkilisi', email: 'bilgiislem@okuladi.k12.tr', password: '123', role: 'bilgi_islem', kademe: null },
    { name: 'Anaokulu Müdürü', email: 'anaokulu.mudur@okuladi.k12.tr', password: '123', role: 'mudur', kademe: 'Anaokulu' },
    { name: 'İlkokul Müdürü', email: 'ilkokul.mudur@okuladi.k12.tr', password: '123', role: 'mudur', kademe: 'İlkokul' },
    { name: 'Ortaokul Müdürü', email: 'ortaokul.mudur@okuladi.k12.tr', password: '123', role: 'mudur', kademe: 'Ortaokul' },
    { name: 'Lise Müdürü', email: 'lise.mudur@okuladi.k12.tr', password: '123', role: 'mudur', kademe: 'Lise' },
    { name: 'Örnek Öğretmen', email: 'ogretmen@okuladi.k12.tr', password: '123', role: 'ogretmen', kademe: 'Lise' }
  ];

  defaultUsers.forEach(u => {
    db.run(
      `INSERT OR IGNORE INTO users (name, email, password, role, kademe) VALUES (?, ?, ?, ?, ?)`,
      [u.name, u.email, u.password, u.role, u.kademe]
    );
  });
});

module.exports = db;
