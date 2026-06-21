const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const BACKUP_DIR = path.join(__dirname, 'backup');

// ─── Railway: semua file flat di __dirname ────────────────────────────────────
function getPath(file) {
  const inData = path.join(__dirname, 'data', file);
  const inRoot = path.join(__dirname, file);
  if (fs.existsSync(inData)) return inData;
  if (fs.existsSync(inRoot)) return inRoot;
  return inRoot; // default tulis ke root
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(getPath(file), 'utf8')); }
  catch { return []; }
}

function writeJSON(file, data) {
  try { fs.writeFileSync(getPath(file), JSON.stringify(data, null, 2)); }
  catch { fs.writeFileSync(path.join(__dirname, file), JSON.stringify(data, null, 2)); }
}

const DEFAULT_CONFIG = {
  nama_bisnis: 'Bajang Coffee',
  alamat: 'Lombok, NTB',
  telp: '',
  instagram: '@bajang.coffee',
  bank_name: 'BCA',
  bank_no: '',
  bank_an: 'Bajang Coffee',
  backup_email: '',
  drive_folder_id: '',
  jwt_secret: 'bajangcoffee_secret_2026',
  backup_aktif: false
};

function readConfig() {
  try {
    const p = getPath('config.json');
    return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(p, 'utf8')) };
  } catch { return DEFAULT_CONFIG; }
}

function writeConfig(data) {
  try { fs.writeFileSync(getPath('config.json'), JSON.stringify(data, null, 2)); }
  catch { fs.writeFileSync(path.join(__dirname, 'config.json'), JSON.stringify(data, null, 2)); }
}

function authMiddleware(roles = []) {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token required' });
    try {
      const cfg = readConfig();
      const decoded = jwt.verify(token, cfg.jwt_secret || 'bajangcoffee_secret_2026');
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role))
        return res.status(403).json({ error: 'Akses ditolak' });
      next();
    } catch { res.status(401).json({ error: 'Token tidak valid' }); }
  };
}

function nowID() {
  return new Date().toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
}
function todayStr() {
  return new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Makassar' });
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const users = readJSON('users.json');
  const user = users.find(u => u.username === username && u.aktif);
  if (!user) return res.status(401).json({ error: 'Username tidak ditemukan' });
  if (!bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Password salah' });
  const cfg = readConfig();
  const token = jwt.sign(
    { id: user.id, nama: user.nama, username: user.username, role: user.role },
    cfg.jwt_secret || 'bajangcoffee_secret_2026',
    { expiresIn: '24h' }
  );
  res.json({ token, user: { id: user.id, nama: user.nama, role: user.role } });
});

app.get('/api/auth/me', authMiddleware(), (req, res) => res.json(req.user));

// ─── USERS ────────────────────────────────────────────────────────────────────
app.get('/api/users', authMiddleware(['owner']), (req, res) => {
  res.json(readJSON('users.json').map(u => ({ ...u, password: undefined })));
});

app.post('/api/users', authMiddleware(['owner']), (req, res) => {
  const { nama, username, password, role } = req.body;
  const users = readJSON('users.json');
  if (users.find(u => u.username === username))
    return res.status(400).json({ error: 'Username sudah ada' });
  const user = { id: 'u' + uuidv4().slice(0,8), nama, username, password: bcrypt.hashSync(password, 10), role, aktif: true };
  users.push(user);
  writeJSON('users.json', users);
  res.json({ ok: true, user: { ...user, password: undefined } });
});

app.put('/api/users/:id', authMiddleware(['owner']), (req, res) => {
  const users = readJSON('users.json');
  const idx = users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User tidak ditemukan' });
  const { nama, role, aktif, password } = req.body;
  if (nama) users[idx].nama = nama;
  if (role) users[idx].role = role;
  if (aktif !== undefined) users[idx].aktif = aktif;
  if (password) users[idx].password = bcrypt.hashSync(password, 10);
  writeJSON('users.json', users);
  res.json({ ok: true });
});

// ─── MENU ─────────────────────────────────────────────────────────────────────
app.get('/api/menu', authMiddleware(), (req, res) => {
  const menu = readJSON('menu.json');
  const { kategori } = req.query;
  res.json(kategori ? menu.filter(m => m.kategori === kategori && m.aktif) : menu);
});

app.post('/api/menu', authMiddleware(['owner']), (req, res) => {
  const menu = readJSON('menu.json');
  const item = { id: 'm' + uuidv4().slice(0,8), ...req.body, aktif: true };
  menu.push(item);
  writeJSON('menu.json', menu);
  res.json({ ok: true, item });
});

app.put('/api/menu/:id', authMiddleware(['owner']), (req, res) => {
  const menu = readJSON('menu.json');
  const idx = menu.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Menu tidak ditemukan' });
  menu[idx] = { ...menu[idx], ...req.body };
  writeJSON('menu.json', menu);
  res.json({ ok: true });
});

app.delete('/api/menu/:id', authMiddleware(['owner']), (req, res) => {
  const menu = readJSON('menu.json');
  const idx = menu.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Menu tidak ditemukan' });
  menu[idx].aktif = false;
  writeJSON('menu.json', menu);
  res.json({ ok: true });
});

// ─── ORDERS ───────────────────────────────────────────────────────────────────
app.get('/api/orders', authMiddleware(), (req, res) => {
  let orders = readJSON('orders.json');
  const { tanggal, limit } = req.query;
  if (tanggal) orders = orders.filter(o => o.tanggal === tanggal);
  if (limit) orders = orders.slice(-parseInt(limit));
  res.json(orders.reverse());
});

app.post('/api/orders', authMiddleware(), (req, res) => {
  const { nama_pelanggan, items, metode_bayar, bayar, kembalian } = req.body;
  if (!items?.length) return res.status(400).json({ error: 'Item kosong' });
  const orders = readJSON('orders.json');
  const total = items.reduce((s, i) => s + i.harga * i.qty, 0);
  const total_hpp = items.reduce((s, i) => s + (i.hpp || 0) * i.qty, 0);
  const no_order = 'BC' + String(orders.length + 1).padStart(4, '0');
  const order = {
    id: 'o' + uuidv4().slice(0,8), no_order,
    nama_pelanggan: nama_pelanggan || 'Umum', items,
    total, total_hpp, profit: total - total_hpp,
    metode_bayar, bayar: bayar || total, kembalian: kembalian || 0,
    kasir: req.user.nama, tanggal: todayStr(), waktu: nowID(),
    createdAt: new Date().toISOString()
  };
  orders.push(order);
  writeJSON('orders.json', orders);
  const kas = readJSON('kas.json');
  kas.push({
    id: 'k' + uuidv4().slice(0,8), tipe: 'masuk', kategori: 'Penjualan',
    keterangan: `${no_order} - ${nama_pelanggan || 'Umum'}`,
    jumlah: total, metode: metode_bayar, ref_id: order.id,
    tanggal: todayStr(), waktu: nowID(), user: req.user.nama,
    createdAt: new Date().toISOString()
  });
  writeJSON('kas.json', kas);
  res.json({ ok: true, order });
});

// ─── STOK ─────────────────────────────────────────────────────────────────────
app.get('/api/stok', authMiddleware(), (req, res) => res.json(readJSON('stok.json')));

app.post('/api/stok', authMiddleware(['owner','roaster']), (req, res) => {
  const stok = readJSON('stok.json');
  const item = { id: 's' + uuidv4().slice(0,8), ...req.body, createdAt: new Date().toISOString() };
  stok.push(item);
  writeJSON('stok.json', stok);
  if (req.body.harga_beli && req.body.stok_kg) {
    const kas = readJSON('kas.json');
    kas.push({
      id: 'k' + uuidv4().slice(0,8), tipe: 'keluar', kategori: 'Pembelian Bahan',
      keterangan: `Beli ${req.body.nama} ${req.body.stok_kg}kg`,
      jumlah: req.body.harga_beli * req.body.stok_kg, metode: 'Tunai',
      tanggal: todayStr(), waktu: nowID(), user: req.user.nama,
      createdAt: new Date().toISOString()
    });
    writeJSON('kas.json', kas);
  }
  res.json({ ok: true, item });
});

app.put('/api/stok/:id', authMiddleware(['owner','roaster']), (req, res) => {
  const stok = readJSON('stok.json');
  const idx = stok.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Tidak ditemukan' });
  stok[idx] = { ...stok[idx], ...req.body };
  writeJSON('stok.json', stok);
  res.json({ ok: true });
});

app.delete('/api/stok/:id', authMiddleware(['owner']), (req, res) => {
  writeJSON('stok.json', readJSON('stok.json').filter(s => s.id !== req.params.id));
  res.json({ ok: true });
});

// ─── FERMENTASI ───────────────────────────────────────────────────────────────
app.get('/api/fermentasi', authMiddleware(), (req, res) => {
  const today = new Date();
  const list = readJSON('fermentasi.json').map(f => {
    const diff = Math.ceil((new Date(f.tgl_target) - today) / 86400000);
    return {
      ...f, sisa_hari: diff,
      alert: f.status === 'aktif'
        ? (diff <= 0 ? 'overdue' : diff <= 1 ? 'hari_ini' : diff <= 3 ? 'segera' : 'normal')
        : 'done'
    };
  });
  res.json(list);
});

app.post('/api/fermentasi', authMiddleware(['owner','roaster']), (req, res) => {
  const list = readJSON('fermentasi.json');
  const item = { id: 'f' + uuidv4().slice(0,8), ...req.body, status: 'aktif', createdAt: new Date().toISOString() };
  list.push(item);
  writeJSON('fermentasi.json', list);
  res.json({ ok: true, item });
});

app.put('/api/fermentasi/:id', authMiddleware(['owner','roaster']), (req, res) => {
  const list = readJSON('fermentasi.json');
  const idx = list.findIndex(f => f.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Tidak ditemukan' });
  list[idx] = { ...list[idx], ...req.body };
  writeJSON('fermentasi.json', list);
  res.json({ ok: true });
});

app.delete('/api/fermentasi/:id', authMiddleware(['owner','roaster']), (req, res) => {
  writeJSON('fermentasi.json', readJSON('fermentasi.json').filter(f => f.id !== req.params.id));
  res.json({ ok: true });
});

// ─── KAS ──────────────────────────────────────────────────────────────────────
app.get('/api/kas', authMiddleware(), (req, res) => {
  let kas = readJSON('kas.json');
  const { tanggal, tipe } = req.query;
  if (tanggal) kas = kas.filter(k => k.tanggal === tanggal);
  if (tipe) kas = kas.filter(k => k.tipe === tipe);
  res.json(kas.reverse());
});

app.post('/api/kas', authMiddleware(), (req, res) => {
  const { tipe, kategori, keterangan, jumlah, metode } = req.body;
  if (!tipe || !jumlah) return res.status(400).json({ error: 'Data tidak lengkap' });
  const kas = readJSON('kas.json');
  const entry = {
    id: 'k' + uuidv4().slice(0,8), tipe,
    kategori: kategori || 'Lain-lain', keterangan: keterangan || '',
    jumlah: parseInt(jumlah), metode: metode || 'Tunai',
    tanggal: todayStr(), waktu: nowID(), user: req.user.nama,
    createdAt: new Date().toISOString()
  };
  kas.push(entry);
  writeJSON('kas.json', kas);
  res.json({ ok: true, entry });
});

app.delete('/api/kas/:id', authMiddleware(['owner']), (req, res) => {
  writeJSON('kas.json', readJSON('kas.json').filter(k => k.id !== req.params.id));
  res.json({ ok: true });
});

// ─── LAPORAN ──────────────────────────────────────────────────────────────────
app.get('/api/laporan/dashboard', authMiddleware(), (req, res) => {
  const orders = readJSON('orders.json');
  const kas = readJSON('kas.json');
  const stok = readJSON('stok.json');
  const fermentasi = readJSON('fermentasi.json');
  const today = todayStr();
  const now = new Date();

  const ordersToday = orders.filter(o => o.tanggal === today);
  const kasToday = kas.filter(k => k.tanggal === today);
  const masukToday = kasToday.filter(k => k.tipe === 'masuk').reduce((s,k) => s + k.jumlah, 0);
  const keluarToday = kasToday.filter(k => k.tipe === 'keluar').reduce((s,k) => s + k.jumlah, 0);
  const totalKas = kas.reduce((s,k) => k.tipe === 'masuk' ? s + k.jumlah : s - k.jumlah, 0);

  res.json({
    penjualan_hari_ini: ordersToday.reduce((s,o) => s + o.total, 0),
    profit_hari_ini: ordersToday.reduce((s,o) => s + o.profit, 0),
    order_count: ordersToday.length,
    kas_masuk: masukToday,
    kas_keluar: keluarToday,
    saldo_kas: totalKas,
    stok_kritis: stok.filter(s => s.stok_kg <= s.stok_min),
    fermentasi_alert: fermentasi
      .filter(f => f.status === 'aktif' && Math.ceil((new Date(f.tgl_target) - now) / 86400000) <= 3)
      .map(f => ({ ...f, sisa_hari: Math.ceil((new Date(f.tgl_target) - now) / 86400000) })),
    order_terbaru: ordersToday.slice(-5).reverse()
  });
});

app.get('/api/laporan/penjualan', authMiddleware(), (req, res) => {
  const { dari, sampai } = req.query;
  let orders = readJSON('orders.json');
  if (dari) orders = orders.filter(o => o.tanggal >= dari);
  if (sampai) orders = orders.filter(o => o.tanggal <= sampai);
  const total = orders.reduce((s,o) => s + o.total, 0);
  const profit = orders.reduce((s,o) => s + o.profit, 0);
  const hpp = orders.reduce((s,o) => s + o.total_hpp, 0);
  const menuMap = {};
  orders.forEach(o => o.items.forEach(i => {
    if (!menuMap[i.nama]) menuMap[i.nama] = { nama: i.nama, qty: 0, total: 0, profit: 0 };
    menuMap[i.nama].qty += i.qty;
    menuMap[i.nama].total += i.harga * i.qty;
    menuMap[i.nama].profit += (i.harga - (i.hpp||0)) * i.qty;
  }));
  res.json({
    total_penjualan: total, total_hpp: hpp, total_profit: profit,
    margin: total ? Math.round((profit/total)*100) : 0,
    jumlah_transaksi: orders.length,
    per_menu: Object.values(menuMap).sort((a,b) => b.total - a.total),
    orders: orders.reverse()
  });
});

// ─── CONFIG ───────────────────────────────────────────────────────────────────
app.get('/api/config', authMiddleware(['owner']), (req, res) => {
  const cfg = readConfig();
  res.json({ ...cfg, jwt_secret: undefined });
});

app.put('/api/config', authMiddleware(['owner']), (req, res) => {
  writeConfig({ ...readConfig(), ...req.body });
  res.json({ ok: true });
});

// ─── BACKUP ───────────────────────────────────────────────────────────────────
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function buatBackup() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const data = {
    timestamp: new Date().toISOString(),
    menu: readJSON('menu.json'),
    orders: readJSON('orders.json'),
    stok: readJSON('stok.json'),
    fermentasi: readJSON('fermentasi.json'),
    kas: readJSON('kas.json'),
    config: { ...readConfig(), jwt_secret: undefined }
  };
  const fname = path.join(BACKUP_DIR, `backup-${ts}.json`);
  fs.writeFileSync(fname, JSON.stringify(data, null, 2));
  return fname;
}

app.post('/api/backup/manual', authMiddleware(['owner']), (req, res) => {
  try {
    const fname = buatBackup();
    res.json({ ok: true, file: path.basename(fname) });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/backup/list', authMiddleware(['owner']), (req, res) => {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
      .map(f => ({ nama: f, ukuran: fs.statSync(path.join(BACKUP_DIR, f)).size, waktu: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
      .sort((a,b) => new Date(b.waktu) - new Date(a.waktu));
    res.json(files);
  } catch { res.json([]); }
});

app.get('/api/backup/download/:nama', authMiddleware(['owner']), (req, res) => {
  const fpath = path.join(BACKUP_DIR, req.params.nama);
  if (!fs.existsSync(fpath)) return res.status(404).json({ error: 'File tidak ditemukan' });
  res.download(fpath);
});

app.post('/api/backup/email', authMiddleware(['owner']), async (req, res) => {
  const cfg = readConfig();
  if (!cfg.gmail_user || !cfg.gmail_pass)
    return res.status(400).json({ error: 'Gmail belum dikonfigurasi di Settings' });
  try {
    const fname = buatBackup();
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: cfg.gmail_user, pass: cfg.gmail_pass } });
    await transporter.sendMail({
      from: cfg.gmail_user, to: cfg.backup_email || cfg.gmail_user,
      subject: `Backup Bajang Coffee - ${new Date().toLocaleDateString('id-ID')}`,
      text: `Backup otomatis data Bajang Coffee.\nWaktu: ${nowID()}`,
      attachments: [{ filename: path.basename(fname), path: fname }]
    });
    res.json({ ok: true, pesan: 'Backup terkirim ke email' });
  } catch(e) { res.status(500).json({ error: 'Gagal kirim email: ' + e.message }); }
});

app.post('/api/backup/drive', authMiddleware(['owner']), async (req, res) => {
  const cfg = readConfig();
  if (!cfg.drive_credentials)
    return res.status(400).json({ error: 'Google Drive belum dikonfigurasi' });
  try {
    const { google } = require('googleapis');
    const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(cfg.drive_credentials), scopes: ['https://www.googleapis.com/auth/drive.file'] });
    const drive = google.drive({ version: 'v3', auth });
    const fname = buatBackup();
    const resp = await drive.files.create({
      requestBody: { name: path.basename(fname), parents: cfg.drive_folder_id ? [cfg.drive_folder_id] : undefined },
      media: { mimeType: 'application/json', body: fs.createReadStream(fname) },
      fields: 'id,name'
    });
    res.json({ ok: true, file_id: resp.data.id, nama: resp.data.name });
  } catch(e) { res.status(500).json({ error: 'Gagal upload ke Drive: ' + e.message }); }
});

app.post('/api/backup/restore', authMiddleware(['owner']), (req, res) => {
  const fpath = path.join(BACKUP_DIR, req.body.nama);
  if (!fs.existsSync(fpath)) return res.status(404).json({ error: 'File tidak ditemukan' });
  try {
    const data = JSON.parse(fs.readFileSync(fpath, 'utf8'));
    if (data.menu) writeJSON('menu.json', data.menu);
    if (data.orders) writeJSON('orders.json', data.orders);
    if (data.stok) writeJSON('stok.json', data.stok);
    if (data.fermentasi) writeJSON('fermentasi.json', data.fermentasi);
    if (data.kas) writeJSON('kas.json', data.kas);
    res.json({ ok: true, pesan: 'Data berhasil direstore' });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

cron.schedule('0 23 * * *', () => {
  if (readConfig().backup_aktif) { try { buatBackup(); } catch(e) { console.error('[BACKUP]', e.message); } }
}, { timezone: 'Asia/Makassar' });

// ─── SPA ──────────────────────────────────────────────────────────────────────
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n☕ Bajang Coffee Server running at http://localhost:${PORT}\n`);
});
