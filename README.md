# ☕ Bajang Coffee — Management App

Aplikasi manajemen lengkap untuk Bajang Coffee Roasting & Café.

---

## 🚀 Cara Menjalankan Server

```bash
cd bajang-coffee
npm install
node server.js
```

Server berjalan di: `http://localhost:3000`

---

## 👤 Login Default

| Username | Password | Role |
|----------|----------|------|
| admin    | password | Owner (semua akses) |
| kasir    | password | Kasir POS |
| roaster  | password | Roaster & Stok |

---

## 📱 Install di Android (PWA)

1. Jalankan server di komputer / VPS
2. Buka Chrome di HP Android
3. Ketik IP server, contoh: `http://192.168.1.100:3000`
4. Tap menu Chrome (titik 3) → **"Add to Home Screen"** / **"Install App"**
5. App terpasang seperti APK, bisa dibuka dari home screen

### Kalau mau pakai di luar jaringan WiFi:
- Deploy ke VPS (Niagahoster, DigitalOcean, dll) atau
- Pakai **ngrok** untuk tunnel sementara:
  ```bash
  npm install -g ngrok
  ngrok http 3000
  ```
  Akses dari URL ngrok yang diberikan.

---

## 🔧 Build APK (opsional, pakai Capacitor)

```bash
# Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/android

# Init
npx cap init "Bajang Coffee" "com.bajangcoffee.app"

# Build
npx cap add android
npx cap sync
npx cap open android
# Lalu build APK dari Android Studio
```

---

## 📧 Setup Backup ke Gmail

1. Buka **Setting** di app
2. Isi **Gmail** dengan email Google kamu
3. Isi **App Password** (bukan password Gmail biasa):
   - Buka myaccount.google.com
   - Security → 2-Step Verification → ON
   - App Passwords → buat password baru
   - Copy 16 karakter → paste di app
4. Isi email tujuan backup
5. Tap **"Kirim Backup ke Email Sekarang"** untuk test

Backup otomatis jalan setiap hari jam **23:00 WITA**.

---

## ☁️ Setup Backup ke Google Drive

1. Buka [console.cloud.google.com](https://console.cloud.google.com)
2. Buat project baru
3. Enable **Google Drive API**
4. IAM & Admin → Service Accounts → Buat service account
5. Buat key → Download JSON
6. Di app Setting → tempel isi file JSON ke kolom **Credentials**
7. Buat folder di Google Drive → klik kanan → **Get Link** → copy ID folder
8. Paste ID folder ke kolom **Folder ID Drive**
9. **Share** folder Drive ke email service account (lihat di JSON: `client_email`)
10. Tap **"Upload ke Drive Sekarang"** untuk test

---

## 📂 Struktur Data

```
data/
├── users.json       → akun user
├── menu.json        → daftar menu & HPP
├── orders.json      → semua transaksi POS
├── stok.json        → stok biji kopi
├── fermentasi.json  → batch fermentasi
├── kas.json         → kas masuk/keluar
└── config.json      → pengaturan app

backup/              → file backup otomatis
```

---

## 🛠️ Fitur Lengkap

- ✅ Login multi-user (Owner/Kasir/Roaster)
- ✅ Dashboard real-time (penjualan, profit, stok, saldo)
- ✅ POS Kasir — Tunai & QRIS, struk otomatis, HPP per item
- ✅ Manajemen stok (green bean, roasted, bubuk)
- ✅ Tracker fermentasi + reminder alert
- ✅ Kas masuk/keluar manual + otomatis dari POS
- ✅ Laporan penjualan + menu terlaris + margin/HPP
- ✅ Backup manual/otomatis ke Gmail
- ✅ Backup ke Google Drive
- ✅ Restore dari backup
- ✅ PWA — installable di Android tanpa Play Store
- ✅ Setting info bisnis, bank, QRIS
