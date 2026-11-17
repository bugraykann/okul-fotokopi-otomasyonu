const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const session = require('express-session');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Yükleme klasörünü garanti et
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer dosya yükleme ayarları
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const safeName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E4);
    cb(null, `${uniqueSuffix}-${safeName}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'okul-baski-gizli-anahtar-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 gün
}));

// Statik frontend dosyaları
app.use(express.static(path.join(__dirname, 'public')));
// Yüklenen dosyaları sadece oturum açmış kullanıcılara sunmak için route üzerinden vereceğiz

// Oturum kontrol middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: 'Lütfen giriş yapın.' });
}

// --- AUTH API ---

// Öğretmen Şifresiz Giriş
app.post('/api/auth/teacher-login', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Lütfen adınızı ve soyadınızı giriniz.' });
  }

  const cleanName = name.trim();
  db.get('SELECT * FROM users WHERE name = ? AND role = "ogretmen"', [cleanName], (err, user) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });

    if (user) {
      req.session.user = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        kademe: user.kademe
      };
      return res.json({ success: true, user: req.session.user });
    }

    // İlk defa giriyorsa otomatik hesap aç
    const cleanEmail = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') + '@okuladi.k12.tr';
    db.run(
      'INSERT INTO users (name, email, password, role, kademe) VALUES (?, ?, ?, ?, ?)',
      [cleanName, cleanEmail, 'sifresiz', 'ogretmen', null],
      function (insertErr) {
        if (insertErr) {
          const fallbackEmail = `${Date.now()}@okuladi.k12.tr`;
          db.run(
            'INSERT INTO users (name, email, password, role, kademe) VALUES (?, ?, ?, ?, ?)',
            [cleanName, fallbackEmail, 'sifresiz', 'ogretmen', null],
            function (secondErr) {
              if (secondErr) return res.status(500).json({ error: 'Öğretmen hesabı oluşturulamadı.' });
              req.session.user = { id: this.lastID, name: cleanName, email: fallbackEmail, role: 'ogretmen', kademe: null };
              return res.json({ success: true, user: req.session.user });
            }
          );
          return;
        }

        req.session.user = {
          id: this.lastID,
          name: cleanName,
          email: cleanEmail,
          role: 'ogretmen',
          kademe: null
        };
        return res.json({ success: true, user: req.session.user });
      }
    );
  });
});

// Kayıtlı öğretmenler listesi (Şifresiz hızlı seçim için)
app.get('/api/auth/teachers', (req, res) => {
  db.all('SELECT id, name FROM users WHERE role = "ogretmen" ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Liste alınamadı' });
    return res.json(rows || []);
  });
});

// Giriş yap (İdare ve Bilgi İşlem için Şifreli)
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre gereklidir.' });
  }

  db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email.trim(), password.trim()], (err, user) => {
    if (err) return res.status(500).json({ error: 'Veritabanı hatası' });
    if (!user) return res.status(401).json({ error: 'Geçersiz e-posta veya şifre!' });

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      kademe: user.kademe
    };

    return res.json({ success: true, user: req.session.user });
  });
});

// Mevcut kullanıcı bilgisi
app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({ loggedIn: true, user: req.session.user });
  }
  return res.json({ loggedIn: false });
});

// Çıkış yap
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// Kayıt ol (İsteğe bağlı hızlı hesap açma)
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role, kademe } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Tüm alanları doldurunuz.' });
  }

  const userRole = role || 'ogretmen';
  db.run(
    `INSERT INTO users (name, email, password, role, kademe) VALUES (?, ?, ?, ?, ?)`,
    [name.trim(), email.trim(), password.trim(), userRole, kademe || null],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlı!' });
        }
        return res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
      }

      req.session.user = {
        id: this.lastID,
        name: name.trim(),
        email: email.trim(),
        role: userRole,
        kademe: kademe || null
      };

      return res.json({ success: true, user: req.session.user });
    }
  );
});

// --- KULLANICI YÖNETİMİ API (Sadece Bilgi İşlem / Admin) ---

// Kullanıcı listesi
app.get('/api/admin/users', requireAuth, (req, res) => {
  if (req.session.user.role !== 'bilgi_islem' && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim.' });
  }

  db.all('SELECT id, name, email, role, kademe, created_at FROM users ORDER BY role, name', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Kullanıcılar alınamadı.' });
    return res.json(rows);
  });
});

// Yeni kullanıcı ekle
app.post('/api/admin/users', requireAuth, (req, res) => {
  if (req.session.user.role !== 'bilgi_islem' && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim.' });
  }

  const { name, email, password, role, kademe } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Ad, e-posta, şifre ve rol zorunludur.' });
  }

  db.run(
    'INSERT INTO users (name, email, password, role, kademe) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), email.trim(), password.trim(), role, kademe || null],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ error: 'Bu e-posta adresi zaten sistemde kayıtlı!' });
        }
        return res.status(500).json({ error: 'Kullanıcı eklenemedi.' });
      }
      return res.json({ success: true, message: 'Kullanıcı başarıyla eklendi.', id: this.lastID });
    }
  );
});

// Şifre sıfırla
app.post('/api/admin/users/:id/reset-password', requireAuth, (req, res) => {
  if (req.session.user.role !== 'bilgi_islem' && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim.' });
  }

  const { password } = req.body;
  if (!password || password.trim().length < 3) {
    return res.status(400).json({ error: 'Yeni şifre en az 3 karakter olmalıdır.' });
  }

  db.run(
    'UPDATE users SET password = ? WHERE id = ?',
    [password.trim(), req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Şifre güncellenemedi.' });
      return res.json({ success: true, message: 'Şifre başarıyla güncellendi.' });
    }
  );
});

// Kullanıcı sil
app.delete('/api/admin/users/:id', requireAuth, (req, res) => {
  if (req.session.user.role !== 'bilgi_islem' && req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Yetkisiz erişim.' });
  }

  if (parseInt(req.params.id, 10) === req.session.user.id) {
    return res.status(400).json({ error: 'Kendi hesabınızı silemezsiniz.' });
  }

  db.run('DELETE FROM users WHERE id = ?', [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: 'Kullanıcı silinemedi.' });
    return res.json({ success: true, message: 'Kullanıcı başarıyla silindi.' });
  });
});

// --- BASKI TALEPLERİ API ---

// 1. Öğretmen: Yeni talep oluştur
app.post('/api/requests', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Lütfen yazdırılacak bir dosya seçin.' });
  }

  const {
    kademe,
    copy_count = 1,
    color_mode = 'SB',
    duplex_mode = 'Tek',
    pages_per_sheet = 1,
    paper_size = 'A4',
    note = ''
  } = req.body;

  if (!kademe) {
    return res.status(400).json({ error: 'Lütfen kademe seçin (Anaokulu, İlkokul, Ortaokul, Lise).' });
  }

  const user = req.session.user;

  const sql = `
    INSERT INTO print_requests (
      teacher_id, teacher_name, teacher_email, kademe,
      file_original_name, file_saved_name, file_path, file_size,
      copy_count, color_mode, duplex_mode, pages_per_sheet, paper_size, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const params = [
    user.id,
    user.name,
    user.email,
    kademe,
    req.file.originalname,
    req.file.filename,
    req.file.path,
    req.file.size,
    parseInt(copy_count, 10) || 1,
    color_mode,
    duplex_mode,
    parseInt(pages_per_sheet, 10) || 1,
    paper_size,
    note
  ];

  db.run(sql, params, function (err) {
    if (err) {
      console.error('Talep kaydetme hatası:', err);
      return res.status(500).json({ error: 'Talep kaydedilemedi.' });
    }

    const newRequestId = this.lastID;

    // Veritabanından tam kaydı alıp socket ile ilgili müdüre bildir
    db.get('SELECT * FROM print_requests WHERE id = ?', [newRequestId], (fetchErr, row) => {
      if (!fetchErr && row) {
        // İlgili kademenin müdür odasına bildir
        io.to(`kademe_${kademe}`).emit('new_request_for_approval', row);
      }
    });

    return res.json({ success: true, message: 'Talebiniz ilgili kademe müdürünün onayına iletildi.', id: newRequestId });
  });
});

// 2. Öğretmen: Kendi taleplerini listele
app.get('/api/requests/my', requireAuth, (req, res) => {
  const user = req.session.user;
  db.all('SELECT * FROM print_requests WHERE teacher_id = ? ORDER BY created_at DESC', [user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veri çekilemedi.' });
    return res.json(rows);
  });
});

// 3. Müdür: Kendi kademesindeki bekleyen talepleri listele
app.get('/api/requests/pending-approval', requireAuth, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'mudur' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu alana sadece müdürler erişebilir.' });
  }

  // Müdürün kademesine göre filtrele
  let sql = 'SELECT * FROM print_requests WHERE status = "beklemede"';
  const params = [];

  if (user.role === 'mudur' && user.kademe) {
    sql += ' AND kademe = ?';
    params.push(user.kademe);
  }
  sql += ' ORDER BY created_at ASC';

  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Veri çekilemedi.' });
    return res.json(rows);
  });
});

// 4. Müdür: Talebi Onayla
app.post('/api/requests/:id/approve', requireAuth, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'mudur' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Sadece müdürler onaylayabilir.' });
  }

  const requestId = req.params.id;
  const now = new Date().toISOString();

  db.run(
    `UPDATE print_requests 
     SET status = 'onaylandi', approved_by = ?, approved_at = ? 
     WHERE id = ? AND status = 'beklemede'`,
    [user.name, now, requestId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Onaylanamadı.' });
      if (this.changes === 0) return res.status(400).json({ error: 'Talep bulunamadı veya zaten işleme alınmış.' });

      // Bilgi İşlem ekranını ve öğretmeni uyar
      db.get('SELECT * FROM print_requests WHERE id = ?', [requestId], (fetchErr, row) => {
        if (!fetchErr && row) {
          // BİLGİ İŞLEM EKRANINA ZİL ÇALDIR VE LİSTEYE EKLE
          io.to('bilgi_islem').emit('request_approved_for_print', row);
          // Öğretmene bildir
          io.to(`user_${row.teacher_id}`).emit('status_updated', { id: row.id, status: 'onaylandi' });
        }
      });

      return res.json({ success: true, message: 'Talep onaylandı ve Bilgi İşlem kuyruğuna iletildi.' });
    }
  );
});

// 5. Müdür: Talebi Reddet
app.post('/api/requests/:id/reject', requireAuth, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'mudur' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Sadece müdürler reddedebilir.' });
  }

  const requestId = req.params.id;
  const { reason = 'Gerekçe belirtilmedi' } = req.body;

  db.run(
    `UPDATE print_requests 
     SET status = 'reddedildi', rejection_reason = ? 
     WHERE id = ? AND status = 'beklemede'`,
    [reason, requestId],
    function (err) {
      if (err) return res.status(500).json({ error: 'İşlem yapılamadı.' });

      db.get('SELECT * FROM print_requests WHERE id = ?', [requestId], (fetchErr, row) => {
        if (!fetchErr && row) {
          io.to(`user_${row.teacher_id}`).emit('status_updated', { id: row.id, status: 'reddedildi', reason });
        }
      });

      return res.json({ success: true, message: 'Talep reddedildi.' });
    }
  );
});

// 6. Bilgi İşlem: Baskı Kuyruğunu Listele (Onaylananlar ve Yeni Tamamlananlar)
app.get('/api/requests/print-queue', requireAuth, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'bilgi_islem' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Bu alana sadece Bilgi İşlem erişebilir.' });
  }

  db.all(
    `SELECT * FROM print_requests 
     WHERE status IN ('onaylandi', 'tamamlandi') 
     ORDER BY CASE WHEN status = 'onaylandi' THEN 1 ELSE 2 END, approved_at DESC
     LIMIT 50`,
    [],
    (err, rows) => {
      if (err) return res.status(500).json({ error: 'Kuyruk alınamadı.' });
      return res.json(rows);
    }
  );
});

// 7. Bilgi İşlem: "Yazdırıldı / Hazır" Olarak İşaretle
app.post('/api/requests/:id/complete', requireAuth, (req, res) => {
  const user = req.session.user;
  if (user.role !== 'bilgi_islem' && user.role !== 'admin') {
    return res.status(403).json({ error: 'Sadece Bilgi İşlem tamamlayabilir.' });
  }

  const requestId = req.params.id;
  const now = new Date().toISOString();

  db.run(
    `UPDATE print_requests 
     SET status = 'tamamlandi', completed_at = ? 
     WHERE id = ?`,
    [now, requestId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Güncellenemedi.' });

      db.get('SELECT * FROM print_requests WHERE id = ?', [requestId], (fetchErr, row) => {
        if (!fetchErr && row) {
          // Öğretmene haber ver: "Çıktınız hazır, teslim alabilirsiniz"
          io.to(`user_${row.teacher_id}`).emit('status_updated', {
            id: row.id,
            status: 'tamamlandi',
            message: 'Çıktınız hazır! Bilgi işlem odasından teslim alabilirsiniz.'
          });
          // Bilgi işlem ekranında güncelle
          io.to('bilgi_islem').emit('request_completed_updated', row);
        }
      });

      return res.json({ success: true, message: 'Baskı tamamlandı olarak işaretlendi.' });
    }
  );
});

// 8. Dosya İndirme / Görüntüleme
app.get('/api/files/:id', requireAuth, (req, res) => {
  const requestId = req.params.id;
  db.get('SELECT * FROM print_requests WHERE id = ?', [requestId], (err, row) => {
    if (err || !row) return res.status(404).send('Dosya bulunamadı.');

    const filePath = path.join(uploadDir, row.file_saved_name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Dosya diskte bulunamadı.');
    }

    res.download(filePath, row.file_original_name);
  });
});

// --- SOCKET.IO BAĞLANTILARI ---
io.on('connection', (socket) => {
  // Kullanıcı oda kaydı (role ve id'ye göre)
  socket.on('join_room', (data) => {
    if (!data) return;
    const { role, kademe, userId } = data;

    if (userId) {
      socket.join(`user_${userId}`);
    }
    if (role === 'bilgi_islem' || role === 'admin') {
      socket.join('bilgi_islem');
    }
    if (role === 'mudur' && kademe) {
      socket.join(`kademe_${kademe}`);
    }
  });
});

// Sunucuyu başlat
server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(` Okul Baskı/Fotokopi Otomasyonu Çalışıyor!`);
  console.log(` Port: ${PORT}`);
  console.log(` Yerel Erişim: http://localhost:${PORT}`);
  console.log(` Ağdaki Cihazlar: http://<BILGISAYAR_IP>:${PORT}`);
  console.log(`===============================================`);
});
