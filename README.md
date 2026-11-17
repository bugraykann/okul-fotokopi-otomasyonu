# Okul Fotokopi & Baskı Talep Otomasyon Sistemi

Okul içi fotokopi ve baskı süreçlerini dijitalleştiren; öğretmen, kademe müdürlükleri ve bilgi işlem arasındaki onay ve yazdırma akışını otomatikleştiren yerel ağ (Intranet) uygulaması.

---

## Özellikler

- **Öğretmen Portalı (Mobil & PWA Uyumlu):** 
  - Belge yükleme (PDF, Word, Excel, Resim).
  - Kademe seçimi (Anaokulu, İlkokul, Ortaokul, Lise).
  - Baskı parametreleri: Kopya adedi, Siyah-Beyaz / Renkli, Tek Yön / Arkalı-Önlü, Sayfa Başına Sayfa (1, 2, 4), Kağıt boyutu (A4, A3).
  - Anlık talep durumu takibi ("Müdür Onayı Bekliyor", "Onaylandı (Sırada)", "Çıktınız Hazır").
- **Müdürlük Onay Portalı:**
  - Sadece kendi kademesindeki öğretmenlerin bekleyen taleplerini görme.
  - Tek tıkla onaylama veya gerekçe ile reddetme.
- **Bilgi İşlem Kontrol Masası:**
  - Müdür onayladığı anda canlı iki tonlu sesli uyarı zili (Ding-Dong).
  - Yazdırılacak işler, toplam kopya adedi ve tamamlanan işler metrikleri.
  - Tek tıkla belgeyi açma ve "Yazdırıldı (Hazır)" butonu ile öğretmene anlık bildirim gönderme.
- **Teknoloji:** Node.js, Express, Socket.io, SQLite, Multer, Vanilla JS, CSS3 (Pastel Okul Teması).

---

## Windows 10 Bilgi İşlem Bilgisayarında Kurulum

### 1. Gereksinimler
- Bilgisayarda **Node.js** yüklü olmalıdır. (Kurulu değilse [nodejs.org](https://nodejs.org/) adresinden LTS sürümünü kurun).

### 2. Bağımlılıkları Yükleme
Komut İstemi (CMD) veya PowerShell'i proje klasöründe açın:
```cmd
npm install
```

### 3. Sunucuyu Başlatma
- Klasör içindeki **`baslat.bat`** dosyasına çift tıklayın.
- Veya terminalde:
  ```cmd
  node server.js
  ```

---

## Windows Güvenlik Duvarı (Firewall) İzni
Öğretmenlerin telefonlarından bağlanabilmesi için CMD'yi **Yönetici olarak** açıp şu komutu çalıştırın:
```cmd
netsh advfirewall firewall add rule name="Okul Fotokopi Portali" dir=in action=allow protocol=TCP localport=3000
```

---

## Varsayılan Test Hesapları

| Rol | E-Posta | Şifre | Kapsam |
| :--- | :--- | :--- | :--- |
| **Bilgi İşlem** | `bilgiislem@okuladi.k12.tr` | `123` | Tüm Onaylanan İşler & Sesli Zil |
| **Lise Müdürü** | `lise.mudur@okuladi.k12.tr` | `123` | Lise Talepleri |
| **Ortaokul Müdürü** | `ortaokul.mudur@okuladi.k12.tr` | `123` | Ortaokul Talepleri |
| **İlkokul Müdürü** | `ilkokul.mudur@okuladi.k12.tr` | `123` | İlkokul Talepleri |
| **Anaokulu Müdürü**| `anaokulu.mudur@okuladi.k12.tr`| `123` | Anaokulu Talepleri |
| **Öğretmen** | `ogretmen@okuladi.k12.tr` | `123` | Talep Gönderme & Takip |
