const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Base directories
const BASE_DIR = path.join(__dirname, '..', 'public', 'assets');
const TILES_DIR = path.join(BASE_DIR, 'tiles');
const FURNITURE_DIR = path.join(BASE_DIR, 'furniture');
const CHARACTERS_DIR = path.join(BASE_DIR, 'characters');
const EFFECTS_DIR = path.join(BASE_DIR, 'effects');

[BASE_DIR, TILES_DIR, FURNITURE_DIR, CHARACTERS_DIR, EFFECTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// PNG Encoder
function createPng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth 8
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const ihdrChunk = createChunk('IHDR', ihdr);

  const scanlineSize = width * 4 + 1;
  const rawData = Buffer.alloc(scanlineSize * height);

  for (let y = 0; y < height; y++) {
    rawData[y * scanlineSize] = 0;
    rgbaBuffer.copy(rawData, y * scanlineSize + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(4 + 4 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crcTarget = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(crcTarget), 8 + len);
  return buf;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Pixel Canvas Helper
class PixelCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.buffer = Buffer.alloc(width * height * 4, 0);
  }

  setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const idx = (y * this.width + x) * 4;
    if (a < 255) {
      const srcA = a / 255;
      const dstA = this.buffer[idx + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA > 0) {
        this.buffer[idx] = Math.round((r * srcA + this.buffer[idx] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 1] = Math.round((g * srcA + this.buffer[idx + 1] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 2] = Math.round((b * srcA + this.buffer[idx + 2] * dstA * (1 - srcA)) / outA);
        this.buffer[idx + 3] = Math.round(outA * 255);
      }
    } else {
      this.buffer[idx] = r;
      this.buffer[idx + 1] = g;
      this.buffer[idx + 2] = b;
      this.buffer[idx + 3] = a;
    }
  }

  fillRect(x, y, w, h, r, g, b, a = 255) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) {
        this.setPixel(px, py, r, g, b, a);
      }
    }
  }

  fillDiamond(cx, cy, rx, ry, r, g, b, a = 255) {
    for (let py = -ry; py <= ry; py++) {
      const span = Math.round((1 - Math.abs(py) / ry) * rx);
      for (let px = -span; px <= span; px++) {
        this.setPixel(cx + px, cy + py, r, g, b, a);
      }
    }
  }

  drawIsoDiamond(cx, cy, rx, ry, colTop, colBorder) {
    this.fillDiamond(cx, cy, rx, ry, colTop[0], colTop[1], colTop[2], colTop[3] || 255);
    // Diamond border
    for (let py = -ry; py <= ry; py++) {
      const span = Math.round((1 - Math.abs(py) / ry) * rx);
      this.setPixel(cx - span, cy + py, colBorder[0], colBorder[1], colBorder[2], colBorder[3] || 255);
      this.setPixel(cx + span, cy + py, colBorder[0], colBorder[1], colBorder[2], colBorder[3] || 255);
    }
  }

  drawIsoBlock(cx, cy, rx, ry, height, colTop, colLeft, colRight, colEdge) {
    // Left face
    for (let py = 0; py <= height; py++) {
      for (let step = 0; step <= rx; step++) {
        const x = cx - rx + step;
        const y = cy + (step * (ry / rx)) + py;
        this.setPixel(x, y, colLeft[0], colLeft[1], colLeft[2], 255);
      }
    }
    // Right face
    for (let py = 0; py <= height; py++) {
      for (let step = 0; step <= rx; step++) {
        const x = cx + step;
        const y = cy + ry - (step * (ry / rx)) + py;
        this.setPixel(x, y, colRight[0], colRight[1], colRight[2], 255);
      }
    }
    // Top face
    this.fillDiamond(cx, cy - height, rx, ry, colTop[0], colTop[1], colTop[2], 255);

    // Edges
    if (colEdge) {
      for (let py = -ry; py <= ry; py++) {
        const span = Math.round((1 - Math.abs(py) / ry) * rx);
        this.setPixel(cx - span, cy - height + py, colEdge[0], colEdge[1], colEdge[2], 255);
        this.setPixel(cx + span, cy - height + py, colEdge[0], colEdge[1], colEdge[2], 255);
      }
      for (let h = 0; h <= height; h++) {
        this.setPixel(cx, cy - height + ry + h, colEdge[0], colEdge[1], colEdge[2], 255);
        this.setPixel(cx - rx, cy + h, colEdge[0], colEdge[1], colEdge[2], 255);
        this.setPixel(cx + rx, cy + h, colEdge[0], colEdge[1], colEdge[2], 255);
      }
    }
  }

  save(filepath) {
    const png = createPng(this.width, this.height, this.buffer);
    fs.writeFileSync(filepath, png);
  }
}

console.log('Generating isometric tiles & furniture assets...');

// 1. ISOMETRIC FLOOR TILES (64x32)
function generateTile(filename, colTop, colBorder, patternFn) {
  const canvas = new PixelCanvas(64, 32);
  const cx = 32, cy = 16, rx = 31, ry = 15;
  canvas.drawIsoDiamond(cx, cy, rx, ry, colTop, colBorder);
  if (patternFn) patternFn(canvas, cx, cy, rx, ry);
  canvas.save(path.join(TILES_DIR, filename));
}

// Wood Parquet (Boss Room)
generateTile('floor_wood.png', [107, 65, 38], [75, 42, 22], (c, cx, cy) => {
  for (let i = -12; i <= 12; i += 6) {
    c.setPixel(cx + i, cy - 6, 128, 82, 49, 180);
    c.setPixel(cx + i + 2, cy + 4, 88, 52, 29, 180);
  }
});

// Meeting Quartz (Ruang Meeting Kaca)
generateTile('floor_meeting.png', [40, 55, 82], [30, 42, 65], (c, cx, cy) => {
  c.drawIsoDiamond(cx, cy, 20, 9, [48, 66, 96], [60, 85, 120]);
});

// Builder Room (Tech Cyber Grid)
generateTile('floor_builder.png', [24, 34, 58], [15, 22, 40], (c, cx, cy) => {
  for (let x = 16; x <= 48; x += 8) {
    c.setPixel(x, cy, 56, 189, 248, 120);
  }
});

// Open Workspace (Navy Charcoal Acoustic Carpet)
generateTile('floor_open_workspace.png', [30, 41, 68], [22, 30, 50], (c, cx, cy) => {
  for (let py = 8; py < 24; py += 3) {
    for (let px = 18; px < 46; px += 4) {
      if ((px + py) % 2 === 0) c.setPixel(px, py, 38, 52, 85, 200);
    }
  }
});

// Game Room (Retro Dark Violet Checker)
generateTile('floor_game.png', [54, 32, 75], [38, 20, 54], (c, cx, cy) => {
  c.drawIsoDiamond(cx, cy, 18, 8, [76, 42, 105], [95, 55, 130]);
});

// Lounge (Emerald Teal Plush Rug)
generateTile('floor_lounge.png', [28, 56, 52], [20, 42, 38], (c, cx, cy) => {
  c.drawIsoDiamond(cx, cy, 22, 10, [36, 75, 70], [48, 98, 92]);
});

// Cafe (Warm Terracotta / Hex Stone)
generateTile('floor_cafe.png', [88, 56, 46], [64, 38, 30], (c, cx, cy) => {
  for (let step = -14; step <= 14; step += 7) {
    c.setPixel(cx + step, cy, 115, 72, 60, 160);
    c.setPixel(cx, cy + (step > 0 ? 3 : -3), 115, 72, 60, 160);
  }
});

// Default Hallway Tile
generateTile('floor_hallway.png', [26, 36, 60], [18, 25, 42]);

// 2. WALLS & WINDOWS
// Wall left with city skyline
{
  const w = 64, h = 96;
  const c = new PixelCanvas(w, h);
  // Outer frame
  c.fillRect(0, 0, w, h, 14, 22, 45);
  // Window glass background (dark night city view)
  c.fillRect(6, 6, 52, 68, 8, 12, 28);

  // Distant glowing skyscrapers & lights
  c.fillRect(10, 32, 10, 42, 18, 28, 52);
  c.fillRect(23, 22, 12, 52, 24, 38, 68);
  c.fillRect(38, 28, 16, 46, 16, 26, 50);

  // Tiny glowing window lights
  const lightColors = [[254, 240, 138], [96, 165, 250], [244, 114, 182], [147, 197, 253]];
  for (let y = 26; y < 70; y += 5) {
    for (let x = 12; x < 50; x += 4) {
      if ((x * 7 + y * 13) % 5 === 0) {
        const col = lightColors[(x + y) % lightColors.length];
        c.setPixel(x, y, col[0], col[1], col[2], 220);
      }
    }
  }

  // Window frame dividers (cross glass)
  c.fillRect(31, 6, 2, 68, 32, 48, 85);
  c.fillRect(6, 40, 52, 2, 32, 48, 85);

  // Glass reflection shine diagonal
  for (let i = 0; i < 30; i++) {
    c.setPixel(12 + i, 12 + i, 200, 230, 255, 60);
    c.setPixel(13 + i, 12 + i, 200, 230, 255, 40);
  }

  // Wall baseboard
  c.fillRect(0, 80, w, 16, 20, 30, 56);
  c.fillRect(0, 78, w, 2, 45, 65, 110);
  c.save(path.join(TILES_DIR, 'wall_window_city.png'));
}

// Glass Partition (Ruang Meeting)
{
  const w = 64, h = 64;
  const c = new PixelCanvas(w, h);
  // Glass tint
  for (let y = 10; y < 58; y++) {
    for (let x = 10; x < 54; x++) {
      c.setPixel(x, y, 56, 189, 248, 45); // cyan glass
    }
  }
  // Aluminum frame
  c.fillRect(8, 8, 48, 3, 148, 163, 184, 220);
  c.fillRect(8, 56, 48, 3, 100, 116, 139, 220);
  c.fillRect(8, 8, 3, 50, 148, 163, 184, 220);
  c.fillRect(53, 8, 3, 50, 100, 116, 139, 220);
  c.save(path.join(TILES_DIR, 'glass_partition.png'));
}

// 3. FURNITURE ASSETS
// Desk Wood Boss (Ruang Bos)
{
  const w = 80, h = 64;
  const c = new PixelCanvas(w, h);
  // Isometric desk body
  c.drawIsoBlock(40, 44, 30, 15, 20, [139, 90, 43], [98, 62, 28], [118, 76, 35], [60, 36, 16]);
  // Gold inlay trim
  for (let x = 20; x <= 60; x += 2) {
    c.setPixel(x, 24, 234, 179, 8, 200);
  }
  // Laptop on desk
  c.fillRect(34, 18, 14, 9, 203, 213, 225); // base
  c.fillRect(34, 9, 14, 9, 30, 41, 59);    // screen
  c.fillRect(35, 10, 12, 7, 56, 189, 248);  // display glow
  // Brass lamp
  c.fillRect(56, 12, 3, 10, 234, 179, 8);
  c.fillRect(54, 8, 7, 4, 245, 158, 11);
  c.save(path.join(FURNITURE_DIR, 'desk_wood_boss.png'));
}

// Chesterfield Sofa (Ruang Bos)
{
  const w = 72, h = 56;
  const c = new PixelCanvas(w, h);
  // Rich oxblood / dark mahogany tufted leather
  c.drawIsoBlock(36, 40, 26, 13, 18, [127, 29, 29], [88, 20, 20], [105, 24, 24], [55, 12, 12]);
  // Tufted button highlights
  for (let y = 24; y <= 32; y += 4) {
    for (let x = 24; x <= 48; x += 6) {
      c.setPixel(x, y, 153, 27, 27);
      c.setPixel(x + 1, y + 1, 69, 10, 10);
    }
  }
  // Armrests rolled
  c.fillRect(10, 24, 8, 14, 110, 25, 25);
  c.fillRect(54, 24, 8, 14, 95, 20, 20);
  c.save(path.join(FURNITURE_DIR, 'chesterfield_sofa.png'));
}

// Bookshelf (Ruang Bos)
{
  const w = 54, h = 76;
  const c = new PixelCanvas(w, h);
  // Wood cabinet
  c.drawIsoBlock(27, 60, 20, 10, 48, [92, 58, 33], [65, 40, 22], [78, 48, 26], [45, 26, 14]);
  // Books on shelves
  const bookColors = [
    [239, 68, 68], [59, 130, 246], [234, 179, 8], [16, 185, 129], [168, 85, 247],
    [249, 115, 22], [236, 72, 153], [14, 165, 233]
  ];
  for (let shelfY = 20; shelfY <= 50; shelfY += 12) {
    for (let x = 16; x < 40; x += 3) {
      const col = bookColors[(x + shelfY) % bookColors.length];
      const hBook = 6 + (x % 3);
      c.fillRect(x, shelfY - hBook, 2, hBook, col[0], col[1], col[2]);
    }
  }
  c.save(path.join(FURNITURE_DIR, 'bookshelf.png'));
}

// Meeting Table (Ruang Meeting Kaca)
{
  const w = 96, h = 64;
  const c = new PixelCanvas(w, h);
  // Sleek boardroom oval table
  c.drawIsoBlock(48, 44, 38, 18, 16, [71, 85, 105], [51, 65, 85], [60, 75, 95], [30, 41, 59]);
  // Frosted center strip & conference mic
  c.fillDiamond(48, 28, 20, 8, 100, 116, 139, 200);
  c.fillRect(46, 26, 4, 4, 15, 23, 42); // mic hub
  c.setPixel(48, 27, 16, 185, 129); // green status led
  // Notepads & laptops
  c.fillRect(24, 25, 7, 5, 241, 245, 249);
  c.fillRect(66, 25, 7, 5, 241, 245, 249);
  c.save(path.join(FURNITURE_DIR, 'meeting_table.png'));
}

// Work Desk Multi-Monitor (Area Kerja Terbuka)
{
  const w = 84, h = 72;
  const c = new PixelCanvas(w, h);
  // Standing desk surface
  c.drawIsoBlock(42, 54, 32, 16, 20, [51, 65, 85], [30, 41, 59], [40, 53, 72], [15, 23, 42]);

  // Dual/Triple Monitors on heavy arm
  // Main Monitor (horizontal)
  c.fillRect(32, 14, 22, 14, 15, 23, 42);
  c.fillRect(33, 15, 20, 11, 30, 41, 59);
  // Glowing code lines on main monitor
  c.fillRect(35, 17, 12, 1, 56, 189, 248);
  c.fillRect(35, 19, 16, 1, 16, 185, 129);
  c.fillRect(35, 21, 10, 1, 244, 114, 182);
  c.fillRect(35, 23, 14, 1, 250, 204, 21);

  // Secondary Monitor (vertical / portrait)
  c.fillRect(18, 10, 12, 20, 15, 23, 42);
  c.fillRect(19, 11, 10, 18, 20, 30, 48);
  c.fillRect(21, 13, 6, 1, 251, 146, 60);
  c.fillRect(21, 16, 7, 1, 167, 139, 250);
  c.fillRect(21, 19, 5, 1, 56, 189, 248);
  c.fillRect(21, 22, 6, 1, 52, 211, 153);

  // Third small monitor or laptop on right
  c.fillRect(57, 18, 14, 10, 15, 23, 42);
  c.fillRect(58, 19, 12, 8, 16, 185, 129, 220); // chat / dashboard

  // Mechanical Keyboard & Desk mat
  c.fillDiamond(42, 38, 16, 7, 15, 23, 42, 220); // deskmat
  c.fillRect(36, 36, 12, 4, 71, 85, 105);        // keyboard
  c.fillRect(50, 37, 3, 2, 94, 234, 212);        // mouse

  // Mini Desk Plant
  c.fillRect(66, 30, 5, 6, 180, 83, 9); // pot
  c.fillRect(65, 26, 7, 4, 34, 197, 94); // leaves
  c.save(path.join(FURNITURE_DIR, 'work_desk_multimonitor.png'));
}

// Server Rack (Ruang Kaca Builder)
{
  const w = 48, h = 76;
  const c = new PixelCanvas(w, h);
  c.drawIsoBlock(24, 58, 18, 9, 44, [30, 41, 59], [15, 23, 42], [20, 30, 48], [10, 15, 28]);
  // Blinking LED grids
  const ledCols = [[56, 189, 248], [34, 197, 94], [250, 204, 21], [239, 68, 68]];
  for (let y = 18; y <= 50; y += 4) {
    for (let x = 14; x <= 32; x += 4) {
      const col = ledCols[(x + y) % ledCols.length];
      c.setPixel(x, y, col[0], col[1], col[2], 240);
    }
  }
  c.save(path.join(FURNITURE_DIR, 'server_rack.png'));
}

// Billiard Table (Game Room)
{
  const w = 84, h = 60;
  const c = new PixelCanvas(w, h);
  // Green felt table top & mahogany borders
  c.drawIsoBlock(42, 44, 34, 17, 18, [16, 185, 129], [115, 65, 30], [140, 80, 38], [80, 45, 20]);
  // 6 pockets
  const pockets = [[14, 27], [42, 13], [70, 27], [70, 41], [42, 41], [14, 41]];
  pockets.forEach(([px, py]) => c.fillRect(px - 1, py - 1, 3, 3, 10, 10, 10));
  // Triangle of balls
  c.setPixel(48, 27, 239, 68, 68);
  c.setPixel(49, 26, 234, 179, 8);
  c.setPixel(49, 28, 59, 130, 246);
  c.setPixel(36, 27, 248, 250, 252); // cue ball
  c.save(path.join(FURNITURE_DIR, 'billiard_table.png'));
}

// Arcade Cabinet (Game Room)
{
  const w = 44, h = 72;
  const c = new PixelCanvas(w, h);
  // Retro arcade body
  c.drawIsoBlock(22, 54, 16, 8, 42, [147, 51, 234], [88, 28, 135], [107, 33, 168], [59, 7, 100]);
  // Glowing marquee at top
  c.fillRect(10, 14, 22, 6, 236, 72, 153);
  // CRT Screen with game graphics
  c.fillRect(10, 22, 22, 14, 15, 23, 42);
  c.fillRect(14, 26, 4, 4, 250, 204, 21); // Pacman style character
  c.fillRect(22, 27, 3, 3, 56, 189, 248);  // ghost
  // Joystick & buttons
  c.fillRect(16, 40, 2, 4, 239, 68, 68);
  c.setPixel(16, 39, 255, 0, 0);
  c.setPixel(22, 40, 34, 197, 94);
  c.setPixel(26, 40, 59, 130, 246);
  c.save(path.join(FURNITURE_DIR, 'arcade_cabinet.png'));
}

// Neon TV (Game Room)
{
  const w = 64, h = 54;
  const c = new PixelCanvas(w, h);
  // Ambient neon glow around TV
  for (let py = 6; py < 44; py++) {
    for (let px = 6; px < 58; px++) {
      c.setPixel(px, py, 168, 85, 247, 40);
    }
  }
  // TV Bezel
  c.fillRect(10, 10, 44, 28, 15, 23, 42);
  // Animated TV Screen (cyberpunk game)
  c.fillRect(12, 12, 40, 24, 24, 24, 48);
  c.fillRect(16, 20, 14, 10, 236, 72, 153);
  c.fillRect(32, 16, 12, 14, 56, 189, 248);
  c.save(path.join(FURNITURE_DIR, 'neon_tv.png'));
}

// Bean Bag (Game Room)
{
  const w = 48, h = 40;
  const c = new PixelCanvas(w, h);
  // Cozy teal bean bag
  c.fillDiamond(24, 24, 18, 10, [13, 148, 136][0], [13, 148, 136][1], [13, 148, 136][2]);
  c.fillDiamond(24, 20, 14, 8, 20, 184, 166);
  c.fillDiamond(24, 16, 8, 5, 45, 212, 191);
  c.save(path.join(FURNITURE_DIR, 'bean_bag.png'));
}

// Lounge Sofa (Lounge)
{
  const w = 76, h = 54;
  const c = new PixelCanvas(w, h);
  c.drawIsoBlock(38, 38, 28, 14, 18, [30, 41, 59], [15, 23, 42], [22, 33, 50], [10, 15, 28]);
  // Mustard yellow & teal accent throw pillows
  c.fillRect(20, 22, 8, 8, 234, 179, 8);
  c.fillRect(48, 22, 8, 8, 20, 184, 166);
  c.save(path.join(FURNITURE_DIR, 'lounge_sofa.png'));
}

// Coffee Table (Lounge)
{
  const w = 54, h = 38;
  const c = new PixelCanvas(w, h);
  // Glass coffee table with wooden base
  c.drawIsoBlock(27, 28, 20, 10, 10, [148, 163, 184], [100, 116, 139], [120, 135, 155], [71, 85, 105]);
  // Coffee mugs & open magazine
  c.fillRect(22, 18, 4, 4, 239, 68, 68);
  c.fillRect(32, 17, 7, 5, 248, 250, 252);
  c.save(path.join(FURNITURE_DIR, 'coffee_table.png'));
}

// Cafe Bar (Cafe)
{
  const w = 88, h = 64;
  const c = new PixelCanvas(w, h);
  // Bar counter
  c.drawIsoBlock(44, 46, 34, 17, 22, [180, 83, 9], [120, 53, 15], [146, 64, 14], [69, 26, 3]);
  // Chrome Espresso machine
  c.fillRect(26, 14, 16, 12, 203, 213, 225);
  c.fillRect(28, 12, 12, 4, 148, 163, 184); // steam cup warmer
  c.fillRect(28, 26, 4, 2, 239, 68, 68);   // red portafilter
  c.fillRect(36, 26, 4, 2, 239, 68, 68);
  // Coffee syrups & cups
  c.fillRect(52, 18, 3, 8, 234, 179, 8);
  c.fillRect(57, 18, 3, 8, 168, 85, 247);
  c.fillRect(66, 22, 4, 4, 241, 245, 249);
  c.save(path.join(FURNITURE_DIR, 'cafe_bar.png'));
}

// Bar Stool (Cafe)
{
  const w = 32, h = 42;
  const c = new PixelCanvas(w, h);
  // Round leather seat
  c.fillDiamond(16, 14, 10, 5, 120, 53, 15);
  c.fillDiamond(16, 12, 8, 4, 180, 83, 9);
  // Metal legs
  c.fillRect(15, 18, 2, 18, 148, 163, 184);
  c.fillRect(11, 28, 10, 1, 148, 163, 184); // footrest ring
  c.save(path.join(FURNITURE_DIR, 'bar_stool.png'));
}

// Round Table (Cafe)
{
  const w = 48, h = 44;
  const c = new PixelCanvas(w, h);
  c.fillDiamond(24, 18, 18, 9, 241, 245, 249);
  c.fillDiamond(24, 20, 18, 9, 203, 213, 225);
  c.fillRect(23, 24, 2, 14, 71, 85, 105);
  // Cups on table
  c.fillRect(20, 14, 3, 3, 234, 179, 8);
  c.fillRect(26, 16, 3, 3, 236, 72, 153);
  c.save(path.join(FURNITURE_DIR, 'round_table.png'));
}

// Potted Plant (Fiddle Leaf / Monstera)
{
  const w = 44, h = 56;
  const c = new PixelCanvas(w, h);
  // Ceramic white pot
  c.drawIsoBlock(22, 46, 12, 6, 14, [248, 250, 252], [203, 213, 225], [226, 232, 240], [148, 163, 184]);
  // Soil
  c.fillDiamond(22, 32, 10, 5, 69, 26, 3);
  // Lush large green leaves
  const leaves = [
    [22, 22, 10, 6, [34, 197, 94]],
    [16, 18, 8, 6, [22, 163, 74]],
    [28, 16, 9, 6, [74, 222, 128]],
    [22, 10, 8, 5, [34, 197, 94]],
    [20, 6, 6, 4, [134, 239, 172]]
  ];
  leaves.forEach(([lx, ly, rx, ry, col]) => {
    c.fillDiamond(lx, ly, rx, ry, col[0], col[1], col[2]);
  });
  c.save(path.join(FURNITURE_DIR, 'potted_plant.png'));
}

// 4. CHARACTER SPRITESHEETS
// Each spritesheet: 192 x 48 (6 frames of 32x48 each)
// Frame 0: Idle
// Frame 1: Breath (1-2px vertical offset)
// Frame 2: Walk 1
// Frame 3: Walk 2
// Frame 4: Work/Typing (hands out)
// Frame 5: Wave / Exclamation

function generateCharacterSpritesheet(agentId, skinCol, hairCol, shirtCol, pantsCol, accessoryFn) {
  const frameW = 32, frameH = 48;
  const totalFrames = 6;
  const c = new PixelCanvas(frameW * totalFrames, frameH);

  for (let f = 0; f < totalFrames; f++) {
    const ox = f * frameW;
    let headOffsetY = 0;
    let bodyOffsetY = 0;
    let legLeftY = 0;
    let legRightY = 0;
    let handLeftOut = false;
    let handRightOut = false;
    let waveHand = false;

    if (f === 1) { // Breath
      headOffsetY = -1;
      bodyOffsetY = -1;
    } else if (f === 2) { // Walk 1
      legLeftY = -2;
      legRightY = 2;
    } else if (f === 3) { // Walk 2
      legLeftY = 2;
      legRightY = -2;
    } else if (f === 4) { // Typing / Work
      handLeftOut = true;
      handRightOut = true;
    } else if (f === 5) { // Wave / Alert
      waveHand = true;
      headOffsetY = -1;
    }

    const cx = ox + 16;
    const groundY = 44;

    // Shadow on floor
    c.fillDiamond(cx, groundY, 8, 4, 10, 15, 30, 140);

    // Shoes & Legs
    c.fillRect(cx - 5, groundY - 8 + legLeftY, 4, 8, pantsCol[0], pantsCol[1], pantsCol[2]);
    c.fillRect(cx + 1, groundY - 8 + legRightY, 4, 8, pantsCol[0], pantsCol[1], pantsCol[2]);
    // Shoes
    c.fillRect(cx - 6, groundY - 2 + legLeftY, 5, 2, 15, 23, 42);
    c.fillRect(cx + 1, groundY - 2 + legRightY, 5, 2, 15, 23, 42);

    // Torso / Shirt
    const torsoY = groundY - 20 + bodyOffsetY;
    c.fillRect(cx - 6, torsoY, 12, 12, shirtCol[0], shirtCol[1], shirtCol[2]);
    // Collar / detail
    c.fillRect(cx - 2, torsoY, 4, 4, 255, 255, 255, 80);

    // Arms
    if (handLeftOut) {
      c.fillRect(cx - 10, torsoY + 4, 5, 3, skinCol[0], skinCol[1], skinCol[2]);
    } else {
      c.fillRect(cx - 8, torsoY + 2, 3, 8, shirtCol[0], shirtCol[1], shirtCol[2]);
      c.fillRect(cx - 8, torsoY + 10, 3, 3, skinCol[0], skinCol[1], skinCol[2]);
    }

    if (waveHand) {
      // Raised arm waving
      c.fillRect(cx + 6, torsoY - 8, 3, 8, shirtCol[0], shirtCol[1], shirtCol[2]);
      c.fillRect(cx + 6, torsoY - 11, 4, 4, skinCol[0], skinCol[1], skinCol[2]);
    } else if (handRightOut) {
      c.fillRect(cx + 5, torsoY + 4, 5, 3, skinCol[0], skinCol[1], skinCol[2]);
    } else {
      c.fillRect(cx + 5, torsoY + 2, 3, 8, shirtCol[0], shirtCol[1], shirtCol[2]);
      c.fillRect(cx + 5, torsoY + 10, 3, 3, skinCol[0], skinCol[1], skinCol[2]);
    }

    // Head
    const headY = torsoY - 12 + headOffsetY;
    c.fillRect(cx - 5, headY, 10, 10, skinCol[0], skinCol[1], skinCol[2]);

    // Hair
    c.fillRect(cx - 6, headY - 3, 12, 5, hairCol[0], hairCol[1], hairCol[2]);
    c.fillRect(cx - 6, headY, 3, 6, hairCol[0], hairCol[1], hairCol[2]);

    // Eyes
    c.setPixel(cx - 2, headY + 4, 15, 23, 42);
    c.setPixel(cx + 2, headY + 4, 15, 23, 42);
    // Blush / smile
    c.setPixel(cx - 3, headY + 6, 251, 113, 133, 180);
    c.setPixel(cx + 3, headY + 6, 251, 113, 133, 180);

    // Custom character accessories
    if (accessoryFn) accessoryFn(c, cx, headY, torsoY);
  }

  c.save(path.join(CHARACTERS_DIR, `${agentId}.png`));
}

// 8 Distinct Characters:
// 1. Elfano (kamu) - Founder/Boss: Navy jacket, white shirt, sleek dark hair
generateCharacterSpritesheet('elfano', [255, 219, 172], [40, 30, 25], [37, 99, 235], [30, 41, 59], (c, cx, hy, ty) => {
  // Gold badge / tie
  c.fillRect(cx - 1, ty + 2, 2, 6, 234, 179, 8);
});

// 2. Pompom - Finance: Amber blouse, glasses
generateCharacterSpritesheet('pompom', [255, 224, 189], [90, 50, 30], [245, 158, 11], [51, 65, 85], (c, cx, hy) => {
  // Glasses
  c.fillRect(cx - 3, hy + 3, 3, 2, 255, 255, 255, 200);
  c.fillRect(cx + 1, hy + 3, 3, 2, 255, 255, 255, 200);
});

// 3. Zekky - Lead Architect & AI Researcher: Emerald hoodie, headphones
generateCharacterSpritesheet('zekky', [245, 205, 165], [30, 30, 35], [16, 185, 129], [30, 41, 59], (c, cx, hy) => {
  // Headset
  c.fillRect(cx - 6, hy + 2, 2, 4, 56, 189, 248);
  c.fillRect(cx + 4, hy + 2, 2, 4, 56, 189, 248);
  c.fillRect(cx - 5, hy - 3, 10, 1, 56, 189, 248);
});

// 4. Bobby - Autonomous System Builder: Cyber Visor, Neon plating
generateCharacterSpritesheet('bobby', [226, 232, 240], [100, 116, 139], [245, 158, 11], [71, 85, 105], (c, cx, hy, ty) => {
  // Cyber visor
  c.fillRect(cx - 4, hy + 3, 9, 3, 56, 189, 248);
  // Chest core
  c.setPixel(cx, ty + 5, 245, 158, 11);
});

// 5. Kunyuk - Social Media & Content Creator: Teal streetwear, vibrant hair
generateCharacterSpritesheet('kunyuk', [255, 220, 178], [55, 35, 20], [13, 148, 136], [51, 65, 85]);

// 6. Amoy - Product & Brand Designer: Pink/magenta top, artist beret
generateCharacterSpritesheet('amoy', [255, 225, 195], [120, 45, 75], [236, 72, 153], [30, 41, 59], (c, cx, hy) => {
  // Beret
  c.fillRect(cx - 6, hy - 5, 12, 3, 168, 85, 247);
});

// 7. Jojo - Growth & Performance Marketer: Indigo hoodie, orange sneakers
generateCharacterSpritesheet('jojo', [240, 200, 160], [45, 45, 50], [99, 102, 241], [15, 23, 42]);

// 8. Oyen - Partnership & Business Development: Amber/Gold cardigan, neat brown hair
generateCharacterSpritesheet('oyen', [255, 215, 170], [70, 45, 25], [217, 119, 6], [71, 85, 105]);

// 5. AMBIENT & PARTICLES
// Dust Particle
{
  const c = new PixelCanvas(8, 8);
  c.fillDiamond(4, 4, 3, 3, 254, 240, 138, 220);
  c.setPixel(4, 4, 255, 255, 255, 255);
  c.save(path.join(EFFECTS_DIR, 'dust_particle.png'));
}

// Exclamation Bubble icon (!)
{
  const c = new PixelCanvas(16, 16);
  c.fillDiamond(8, 8, 7, 7, 245, 158, 11);
  c.fillDiamond(8, 8, 5, 5, 251, 191, 36);
  c.fillRect(7, 3, 2, 6, 15, 23, 42);
  c.fillRect(7, 11, 2, 2, 15, 23, 42);
  c.save(path.join(EFFECTS_DIR, 'exclamation.png'));
}

// Glowing target ring (selection halo)
{
  const c = new PixelCanvas(48, 24);
  c.drawIsoDiamond(24, 12, 20, 10, [56, 189, 248, 40], [56, 189, 248, 220]);
  c.save(path.join(EFFECTS_DIR, 'selection_halo.png'));
}

console.log('All isometric assets generated successfully in /public/assets!');
