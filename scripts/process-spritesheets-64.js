const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const CHARACTERS = [
  {
    id: 'elfano',
    alias: 'ariq',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792764606127.png'
  },
  {
    id: 'pompom',
    alias: 'laras',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792764621714.png'
  },
  {
    id: 'zekky',
    alias: 'dimas',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792764593711.png'
  },
  {
    id: 'oyen',
    alias: 'gilang',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792764632185.png'
  },
  {
    id: 'jojo',
    alias: 'raka',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792765405634.png'
  },
  {
    id: 'bobby',
    alias: 'builder',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792765417685.png'
  },
  {
    id: 'kunyuk',
    alias: 'bima',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792765430300.png'
  },
  {
    id: 'amoy',
    alias: 'sari',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792766901294.png'
  }
];

function isBackground(r, g, b, a = 255) {
  if (a < 30) return true;
  // Magenta (#ff00ff and nearby shades)
  const isMagenta = (r > 160 && b > 160 && g < 80) || 
                    (r > 190 && b > 190 && g < 110) || 
                    (r > 200 && b > 200 && g < 130);
  // Gray / near-white background
  const isGray = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && r > 185;
  return isMagenta || isGray;
}

const DIRECTIONS = ['down_left', 'down_right', 'up_right', 'up_left'];
const ACTIONS = ['idle', 'typing', 'walk_0', 'walk_1', 'walk_2', 'walk_3', 'sitting'];

function generateFrameMap(frameW = 64, frameH = 64) {
  const animations = {
    // Idle 4 directions
    idle_down_left: [0],
    idle_down_right: [1],
    idle_up_right: [2],
    idle_up_left: [3],

    // Typing 4 directions
    typing_down_left: [4],
    typing_down_right: [5],
    typing_up_right: [6],
    typing_up_left: [7],

    // Walking 4-frame cycle x 4 directions
    walk_down_left: [8, 12, 16, 20],
    walk_down_right: [9, 13, 17, 21],
    walk_up_right: [10, 14, 18, 22],
    walk_up_left: [11, 15, 19, 23],

    // Sitting in armchair 4 directions
    sit_down_left: [24],
    sit_down_right: [25],
    sit_up_right: [26],
    sit_up_left: [27]
  };

  const frames = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 4; c++) {
      const index = r * 4 + c;
      frames.push({
        index,
        action: ACTIONS[r],
        direction: DIRECTIONS[c],
        x: c * frameW,
        y: r * frameH,
        width: frameW,
        height: frameH
      });
    }
  }

  return {
    frameWidth: frameW,
    frameHeight: frameH,
    totalFrames: 28,
    columns: 4,
    rows: 7,
    directions: DIRECTIONS,
    actions: ACTIONS,
    animations,
    frames
  };
}

function processCharacter(char) {
  const data = fs.readFileSync(char.file);
  const srcPng = PNG.sync.read(data);
  const w = srcPng.width, h = srcPng.height;

  console.log(`\n========================================`);
  console.log(`Processing ${char.id} (${char.alias}) - Source: ${w}x${h}`);
  console.log(`========================================`);

  // 4 columns
  const colBands = [
    [Math.floor(w * 0.15), Math.floor(w * 0.30)],
    [Math.floor(w * 0.35), Math.floor(w * 0.48)],
    [Math.floor(w * 0.52), Math.floor(w * 0.65)],
    [Math.floor(w * 0.68), Math.floor(w * 0.82)]
  ];

  // 7 rows
  const rowBands = [
    [Math.floor(h * 0.03), Math.floor(h * 0.18)], // row 0: idle
    [Math.floor(h * 0.18), Math.floor(h * 0.325)],// row 1: typing
    [Math.floor(h * 0.325), Math.floor(h * 0.45)],// row 2: walk1
    [Math.floor(h * 0.45), Math.floor(h * 0.58)], // row 3: walk2
    [Math.floor(h * 0.58), Math.floor(h * 0.71)], // row 4: walk3
    [Math.floor(h * 0.71), Math.floor(h * 0.85)], // row 5: walk4
    [Math.floor(h * 0.85), h]                     // row 6: sit
  ];

  // Find max standing idle height to normalize scale
  let idleHeight = 0;
  for (let c = 0; c < 4; c++) {
    const [x0, x1] = colBands[c];
    const [y0, y1] = rowBands[0];
    let minY = y1, maxY = y0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const idx = (y * w + x) * 4;
        if (!isBackground(srcPng.data[idx], srcPng.data[idx + 1], srcPng.data[idx + 2], srcPng.data[idx + 3])) {
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    const cellH = maxY - minY + 1;
    if (cellH > idleHeight) idleHeight = cellH;
  }

  // Consistent 52px standing height inside 64x64 frame
  const targetStandingHeight = 52;
  const scale = targetStandingHeight / idleHeight;
  console.log(`Standing idle height: ${idleHeight}px -> Scale factor: ${scale.toFixed(4)}`);

  // Target sheet: 4 columns x 7 rows = 256 x 448 px
  const targetW = 64 * 4;
  const targetH = 64 * 7;
  const sheetPng = new PNG({ width: targetW, height: targetH });

  let framesProcessed = 0;
  const frameStats = [];

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 4; c++) {
      const [x0, x1] = colBands[c];
      const [y0, y1] = rowBands[r];

      let minX = x1, maxX = x0, minY = y1, maxY = y0, pixelCount = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * w + x) * 4;
          if (!isBackground(srcPng.data[idx], srcPng.data[idx + 1], srcPng.data[idx + 2], srcPng.data[idx + 3])) {
            pixelCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (pixelCount === 0) {
        console.warn(`⚠️ Warning: No pixels found in Row ${r} Col ${c}!`);
        continue;
      }

      const origW = maxX - minX + 1;
      const origH = maxY - minY + 1;

      const scaledW = Math.max(1, Math.round(origW * scale));
      const scaledH = Math.max(1, Math.round(origH * scale));

      const frameBaseX = c * 64;
      const frameBaseY = r * 64;

      // Center horizontally in 64px frame
      const offsetX = Math.floor((64 - scaledW) / 2);
      // Align lowest non-bg pixel (feet/chair bottom) at baseline y = 60
      const offsetY = 60 - scaledH;

      let renderedPixels = 0;
      for (let dy = 0; dy < scaledH; dy++) {
        for (let dx = 0; dx < scaledW; dx++) {
          // Nearest neighbor sampling for pure pixel art crispness
          const sx = Math.min(minX + Math.floor(dx / scale), maxX);
          const sy = Math.min(minY + Math.floor(dy / scale), maxY);
          const sidx = (sy * w + sx) * 4;

          const rCol = srcPng.data[sidx];
          const gCol = srcPng.data[sidx + 1];
          const bCol = srcPng.data[sidx + 2];
          const aCol = srcPng.data[sidx + 3];

          if (!isBackground(rCol, gCol, bCol, aCol)) {
            const tx = frameBaseX + offsetX + dx;
            const ty = frameBaseY + offsetY + dy;

            if (tx >= frameBaseX && tx < frameBaseX + 64 && ty >= frameBaseY && ty < frameBaseY + 64) {
              const tidx = (ty * targetW + tx) * 4;
              sheetPng.data[tidx] = rCol;
              sheetPng.data[tidx + 1] = gCol;
              sheetPng.data[tidx + 2] = bCol;
              sheetPng.data[tidx + 3] = 255;
              renderedPixels++;
            }
          }
        }
      }

      framesProcessed++;
      frameStats.push({
        action: ACTIONS[r],
        direction: DIRECTIONS[c],
        origSize: `${origW}x${origH}`,
        scaledSize: `${scaledW}x${scaledH}`,
        pixels: renderedPixels
      });
    }
  }

  console.log(`✅ Extracted & aligned ${framesProcessed}/28 frames perfectly.`);

  const charsDir = path.join(__dirname, '..', 'public', 'assets', 'characters');
  if (!fs.existsSync(charsDir)) fs.mkdirSync(charsDir, { recursive: true });

  const sheetBuffer = PNG.sync.write(sheetPng);
  const outPath = path.join(charsDir, `${char.id}.png`);
  fs.writeFileSync(outPath, sheetBuffer);
  console.log(`💾 Saved spritesheet: public/assets/characters/${char.id}.png (256x448)`);

  // Also save alias (e.g. raka.png for jojo, laras.png for pompom, etc.)
  if (char.alias) {
    const aliasPath = path.join(charsDir, `${char.alias}.png`);
    fs.writeFileSync(aliasPath, sheetBuffer);
    console.log(`🔗 Saved alias spritesheet: public/assets/characters/${char.alias}.png`);
  }

  // Generate frame map JSON
  const frameMap = generateFrameMap(64, 64);
  frameMap.character = char.id;
  frameMap.alias = char.alias;

  const jsonPath = path.join(charsDir, `${char.id}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(frameMap, null, 2));
  console.log(`📄 Saved frame map: public/assets/characters/${char.id}.json`);

  if (char.alias) {
    const aliasJsonPath = path.join(charsDir, `${char.alias}.json`);
    fs.writeFileSync(aliasJsonPath, JSON.stringify(frameMap, null, 2));
  }
}

// Generate complete 28-frame sprite for Amoy (Sari) until user uploads custom sprite
function generateAmoyPlaceholder() {
  console.log(`\n========================================`);
  console.log(`Generating Amoy (Sari) 64x64 Spritesheet`);
  console.log(`========================================`);

  const targetW = 64 * 4;
  const targetH = 64 * 7;
  const sheetPng = new PNG({ width: targetW, height: targetH });

  const hairColor = [180, 50, 100];
  const skinColor = [255, 220, 195];
  const shirtColor = [236, 72, 153];
  const pantsColor = [30, 41, 59];
  const laptopColor = [203, 213, 225];

  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 4; c++) {
      const baseX = c * 64;
      const baseY = r * 64;

      const isSitting = (r === 6);
      const isTyping = (r === 1);
      const walkFrame = (r >= 2 && r <= 5) ? (r - 2) : 0;

      const feetY = 60;
      const headTop = isSitting ? 16 : 8;
      const charHeight = feetY - headTop;

      // Draw character body
      const centerX = baseX + 32;
      for (let y = headTop; y <= feetY; y++) {
        const bodyY = baseY + y;
        const relY = y - headTop;

        let halfW = 8;
        if (relY < 12) halfW = 7; // head
        else if (relY < 28) halfW = 10; // torso
        else halfW = 6; // legs

        // Leg offset during walk
        let legOffsetLeft = 0;
        let legOffsetRight = 0;
        if (walkFrame === 1) { legOffsetLeft = -2; legOffsetRight = 2; }
        if (walkFrame === 3) { legOffsetLeft = 2; legOffsetRight = -2; }

        for (let x = -halfW; x <= halfW; x++) {
          const bodyX = centerX + x;
          const idx = (bodyY * targetW + bodyX) * 4;

          if (relY < 12) {
            // Head / hair
            if (relY < 6 || Math.abs(x) > 4) {
              sheetPng.data[idx] = hairColor[0];
              sheetPng.data[idx + 1] = hairColor[1];
              sheetPng.data[idx + 2] = hairColor[2];
            } else {
              sheetPng.data[idx] = skinColor[0];
              sheetPng.data[idx + 1] = skinColor[1];
              sheetPng.data[idx + 2] = skinColor[2];
            }
          } else if (relY < 28) {
            // Pink shirt
            sheetPng.data[idx] = shirtColor[0];
            sheetPng.data[idx + 1] = shirtColor[1];
            sheetPng.data[idx + 2] = shirtColor[2];
          } else {
            // Pants
            sheetPng.data[idx] = pantsColor[0];
            sheetPng.data[idx + 1] = pantsColor[1];
            sheetPng.data[idx + 2] = pantsColor[2];
          }
          sheetPng.data[idx + 3] = 255;
        }
      }

      // Add laptop if typing
      if (isTyping) {
        for (let ly = baseY + 32; ly <= baseY + 38; ly++) {
          for (let lx = centerX - 8; lx <= centerX + 8; lx++) {
            const idx = (ly * targetW + lx) * 4;
            sheetPng.data[idx] = laptopColor[0];
            sheetPng.data[idx + 1] = laptopColor[1];
            sheetPng.data[idx + 2] = laptopColor[2];
            sheetPng.data[idx + 3] = 255;
          }
        }
      }
    }
  }

  const charsDir = path.join(__dirname, '..', 'public', 'assets', 'characters');
  const buffer = PNG.sync.write(sheetPng);
  fs.writeFileSync(path.join(charsDir, 'amoy.png'), buffer);
  fs.writeFileSync(path.join(charsDir, 'sari.png'), buffer);

  const frameMap = generateFrameMap(64, 64);
  frameMap.character = 'amoy';
  frameMap.alias = 'sari';
  fs.writeFileSync(path.join(charsDir, 'amoy.json'), JSON.stringify(frameMap, null, 2));
  fs.writeFileSync(path.join(charsDir, 'sari.json'), JSON.stringify(frameMap, null, 2));
  console.log(`✅ Generated Amoy (Sari) 64x64 28-frame spritesheet & JSON!`);
}

function main() {
  CHARACTERS.forEach(processCharacter);

  console.log(`\n========================================`);
  console.log(`🎉 ALL 8 REAL CUSTOM CHARACTER SPRITESHEETS & JSON MAPS ARE READY!`);
  console.log(`========================================`);
}

main();
