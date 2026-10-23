# 🎨 Panduan Menaruh Gambar Background & Sprite Agen

Folder ini disiapkan agar kamu bisa dengan mudah menaruh gambar background kantor dan animasi sprite karakter yang baru.

---

## 🖼️ 1. Menaruh Gambar Background Kantor

Web app membaca background utama dari file:
```
public/assets/kantor.png
```

- **Cara Ganti**: Cukup timpa (replace) file `kantor.png` tersebut dengan gambar kantor pilihanmu.
- **Folder Cadangan / Alternatif**: Kamu juga bisa menyimpan background lain di dalam folder:
  ```
  public/assets/backgrounds/
  ```
- **Rekomendasi Format & Ukuran**:
  - Format: `.png` atau `.jpg`
  - Ukuran ideal: **1376 × 768 piksel** atau **1920 × 1080 piksel** (isometrik / lanskap).
  - *Catatan*: Setelah ganti background, gunakan tombol kuning **"Atur Posisi"** di bilah atas web app untuk menyesuaikan posisi meja karakter dengan sekali klik & drag!

---

## 🏃 2. Menaruh Sprite Karakter Bergerak

Setiap karakter memiliki 2 opsi cara memasukkan gambar:

### Opsi A (Paling Mudah — Satu File Spritesheet per Agen)
Taruh file PNG langsung ke folder:
```
public/assets/characters/
├── elfano.png
├── pompom.png
├── zekky.png
├── bobby.png
├── kunyuk.png
├── amoy.png
├── jojo.png
└── oyen.png
```
**Spesifikasi Spritesheet Standar:**
- Ukuran total: **192 × 48 piksel** (gambar horizontal memanjang).
- Terdiri dari **6 frame** berjajar dari kiri ke kanan (masing-masing frame **32 × 48 piksel**):
  - **Frame 1**: Posisi diam (*Idle*)
  - **Frame 2**: Posisi bernapas (*Breath*)
  - **Frame 3**: Melangkah kaki kiri (*Walk 1*)
  - **Frame 4**: Melangkah kaki kanan (*Walk 2*)
  - **Frame 5**: Mengetik keyboard / bekerja (*Typing*)
  - **Frame 6**: Melambaikan tangan / tanda seru (*Alert/Wave*)

---

### Opsi B (Jika Gambar Frame-nya Masih Terpisah-pisah)
Jika kamu punya gambar animasi yang terpisah per gerakan (misal `idle.png`, `walk.png`, `typing.png`), masukkan ke folder masing-masing karakter di:
```
public/assets/raw-frames/
├── elfano/
├── pompom/
├── zekky/
├── bobby/
├── kunyuk/
├── amoy/
├── jojo/
└── oyen/
```
Kamu juga bisa langsung kirimkan filenya di chat, dan saya yang akan menggabungkannya secara otomatis menjadi spritesheet yang siap gerak di dalam game!
