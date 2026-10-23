# 🏢 Kantor AI — Panduan Membuka & Menjalankan

Halo! Web app **"Kantor AI"** telah selesai dibangun untuk **Tahap 1**. Panduan ini ditulis secara sederhana khusus untuk pemula.

---

## 🚀 Cara Membuka Web App (Sangat Mudah)

Saat ini server pengembangan **sudah berjalan secara otomatis** di komputermu!

1. Buka browser favoritmu (Google Chrome, Safari, Microsoft Edge, dll).
2. Ketik alamat berikut di bagian atas (address bar) lalu tekan **Enter**:
   ```
   http://localhost:3000
   ```
3. Kamu akan langsung melihat kantor virtual pixel art dengan 8 agen AI!

---

## 🕹️ Cara Menggunakan Fitur Tahap 1

1. **Melihat Status Agen di Header**:
   - 🟢 **Lagi kerja** (titik hijau): agen sedang mengetik di meja kerja.
   - 🟡 **Nunggu kamu** (titik kuning berdenyut + tanda seru memantul): agen butuh keputusan darimu.
   - 🔵 **Santai** (titik biru): agen sedang istirahat di lounge / cafe / game room.

2. **Geser & Zoom Kantor**:
   - **Geser (Pan)**: Klik dan tahan mouse di area kosong kantor, lalu geser mouse.
   - **Perbesar / Perkecil (Zoom)**: Putar scroll wheel mouse ke atas/bawah, atau gunakan tombol `+` dan `-` di pojok kanan atas.
   - **Reset Tampilan**: Klik tombol putar balik di samping tombol zoom untuk mengembalikan tampilan ke tengah.
   - **Layar HP / Tablet**: Bisa digeser dengan satu jari dan di-zoom dengan cubitan dua jari (pinch-to-zoom).

3. **Membuka Detail Karakter**:
   - Klik karakter siapa saja (misal Pompom, Zekky, atau Elfano).
   - Panel detail akan meluncur keluar dari kanan (*slide-in*) menampilkan nama, peran, system prompt, dan tugas saat ini.
   - Kamu bisa menguji langsung mengubah statusnya (Lagi Kerja / Nunggu Kamu / Santai) dan melihat animasinya berubah seketika!

   **Daftar 8 Karakter & Tugas:**
   - **Elfano (kamu)**: Founder & CEO (Santai - "Memantau strategi & ngopi santai")
   - **Pompom**: Finance Specialist (Nunggu kamu - "Catat nota & mutasi ke...")
   - **Zekky**: Lead Architect & AI Researcher (Lagi kerja - "Riset arsitektur & meeting")
   - **Bobby**: Autonomous Business Builder (Nunggu kamu - "Lengkapi data bisnis")
   - **Kunyuk**: Social Media & Content Creator (Lagi kerja - "Konten sosmed")
   - **Amoy**: Product & Brand Designer (Lagi kerja - "Fondasi desain brand")
   - **Jojo**: Growth & Performance Marketer (Lagi kerja - "Laporan iklan mingguan")
   - **Oyen**: Partnership & Business Development (Nunggu kamu - "Penawaran harga dari bri...")

4. **MODE ATUR POSISI (Kalibrasi Meja)**:
   - Klik tombol kuning bertuliskan **"Atur Posisi"** di bilah atas.
   - Klik dan drag (tarik) masing-masing karakter ke meja yang paling pas di gambar kantor.
   - Di bawah kaki karakter akan muncul angka koordinatnya.
   - Setelah posisinya pas, klik tombol hijau **"Simpan Posisi"**.
   - Koordinat akan tersimpan otomatis ke database SQLite dan file `src/data/agents.json` sehingga posisinya tidak akan hilang saat halaman dimuat ulang.

---

## 🔧 Jika Ingin Menjalankan Ulang Manual di Lain Waktu

Jika suatu saat kamu mematikan laptop dan ingin menjalankannya lagi:

1. Buka aplikasi **Terminal** di Mac kamu.
2. Masuk ke folder proyek:
   ```bash
   cd /Applications/kantor-ai
   ```
3. Ketik perintah ini lalu tekan **Enter**:
   ```bash
   npm run dev
   ```
4. Buka kembali browser di `http://localhost:3000`.

---

## 📁 Di Mana File Proyek Ini Berada?
- Folder utama: `/Applications/kantor-ai`
- Gambar latar kantor: `/Applications/kantor-ai/public/assets/kantor.png`
- Data agen awal: `/Applications/kantor-ai/src/data/agents.json`
- Database: `/Applications/kantor-ai/kantor.db` (SQLite)
- Kunci API: `/Applications/kantor-ai/.env.local`
