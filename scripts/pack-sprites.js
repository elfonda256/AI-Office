const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Directory paths
const RAW_FRAMES_DIR = path.join(__dirname, '..', 'public', 'assets', 'raw-frames');
const CHARACTERS_DIR = path.join(__dirname, '..', 'public', 'assets', 'characters');

console.log('--- SPRITE PACKER HELPER ---');
console.log('Folder raw-frames:', RAW_FRAMES_DIR);
console.log('Folder characters output:', CHARACTERS_DIR);

const characterList = ['elfano', 'pompom', 'zekky', 'bobby', 'kunyuk', 'amoy', 'jojo', 'oyen'];

let packedCount = 0;
characterList.forEach((charId) => {
  const charFolder = path.join(RAW_FRAMES_DIR, charId);
  if (fs.existsSync(charFolder)) {
    const files = fs.readdirSync(charFolder).filter((f) => f.endsWith('.png'));
    if (files.length > 0) {
      console.log(`Ditemukan ${files.length} frame terpisah untuk karakter: ${charId}`);
      packedCount++;
    }
  }
});

if (packedCount === 0) {
  console.log('ℹ️ Belum ada frame terpisah di dalam public/assets/raw-frames/.');
  console.log('Saat ini sistem tetap menggunakan spritesheet yang sudah aktif di public/assets/characters/.');
} else {
  console.log(`✅ ${packedCount} karakter siap diproses.`);
}
