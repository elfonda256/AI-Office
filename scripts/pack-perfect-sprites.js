const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const CHARACTERS = [
  {
    id: 'zekky',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792764593711.png'
  },
  {
    id: 'elfano',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792764606127.png'
  },
  {
    id: 'pompom',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792764621714.png'
  },
  {
    id: 'oyen',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792764632185.png'
  },
  {
    id: 'jojo',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792765405634.png'
  },
  {
    id: 'bobby',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792765417685.png'
  },
  {
    id: 'kunyuk',
    file: '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792765430300.png'
  }
];

function isMagenta(r, g, b) {
  return (r > 160 && b > 160 && g < 80) || (r > 190 && b > 190 && g < 110);
}

function getBBox(png, x0, y0, x1, y1) {
  let minX = x1, maxX = x0, minY = y1, maxY = y0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const idx = (y * png.width + x) * 4;
      const r = png.data[idx];
      const g = png.data[idx + 1];
      const b = png.data[idx + 2];
      if (!isMagenta(r, g, b) && png.data[idx + 3] > 20) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return count > 0 ? { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 } : null;
}

function copyCentered(srcPng, bbox, dstPng, dstOffsetX, targetW, targetH) {
  if (!bbox) return;
  const offsetX = Math.floor((targetW - bbox.width) / 2);
  const offsetY = targetH - bbox.height - 6;

  for (let y = 0; y < bbox.height; y++) {
    for (let x = 0; x < bbox.width; x++) {
      const srcIdx = ((bbox.minY + y) * srcPng.width + (bbox.minX + x)) * 4;
      const r = srcPng.data[srcIdx];
      const g = srcPng.data[srcIdx + 1];
      const b = srcPng.data[srcIdx + 2];

      if (!isMagenta(r, g, b)) {
        const dstX = dstOffsetX + offsetX + x;
        const dstY = offsetY + y;
        if (dstX >= 0 && dstX < dstPng.width && dstY >= 0 && dstY < dstPng.height) {
          const dstIdx = (dstY * dstPng.width + dstX) * 4;
          dstPng.data[dstIdx] = r;
          dstPng.data[dstIdx + 1] = g;
          dstPng.data[dstIdx + 2] = b;
          dstPng.data[dstIdx + 3] = 255;
        }
      }
    }
  }
}

async function processUserSprite(char) {
  return new Promise((resolve) => {
    fs.createReadStream(char.file)
      .pipe(new PNG())
      .on('parsed', function() {
        console.log(`Processing ${char.id} (${this.width}x${this.height})...`);

        const frameW = 80;
        const frameH = 120;

        // Dynamic column X ranges for Col 0 (front-left facing)
        const colX0 = Math.floor(this.width * 0.12);
        const colX1 = Math.floor(this.width * 0.28);

        const rowBands = [
          { name: 'idle', y0: Math.floor(this.height * 0.03), y1: Math.floor(this.height * 0.15) },
          { name: 'typing', y0: Math.floor(this.height * 0.14), y1: Math.floor(this.height * 0.29) },
          { name: 'walk1', y0: Math.floor(this.height * 0.28), y1: Math.floor(this.height * 0.43) },
          { name: 'walk2', y0: Math.floor(this.height * 0.42), y1: Math.floor(this.height * 0.57) },
          { name: 'walk3', y0: Math.floor(this.height * 0.56), y1: Math.floor(this.height * 0.71) },
          { name: 'walk4', y0: Math.floor(this.height * 0.70), y1: Math.floor(this.height * 0.86) },
          { name: 'sit', y0: Math.floor(this.height * 0.85), y1: this.height },
        ];

        const rawDir = path.join(__dirname, '..', 'public', 'assets', 'raw-frames', char.id);
        if (!fs.existsSync(rawDir)) fs.mkdirSync(rawDir, { recursive: true });

        const bboxes = {};
        rowBands.forEach((band) => {
          const bbox = getBBox(this, colX0, band.y0, colX1, band.y1);
          bboxes[band.name] = bbox;
          if (bbox) {
            const singlePng = new PNG({ width: frameW, height: frameH });
            copyCentered(this, bbox, singlePng, 0, frameW, frameH);
            fs.writeFileSync(path.join(rawDir, `${band.name}.png`), PNG.sync.write(singlePng));
          }
        });

        // 6-Frame Spritesheet for Game:
        // Frame 0: Idle
        // Frame 1: Breath (Idle)
        // Frame 2: Walk 1
        // Frame 3: Walk 2
        // Frame 4: Typing (sitting at laptop)
        // Frame 5: Sit (sitting in armchair)
        const frameSequence = [
          bboxes['idle'],
          bboxes['idle'],
          bboxes['walk1'],
          bboxes['walk2'],
          bboxes['typing'],
          bboxes['sit']
        ];

        const sheetPng = new PNG({ width: frameW * 6, height: frameH });

        frameSequence.forEach((bbox, idx) => {
          copyCentered(this, bbox, sheetPng, idx * frameW, frameW, frameH);
        });

        const targetPath = path.join(__dirname, '..', 'public', 'assets', 'characters', `${char.id}.png`);
        fs.writeFileSync(targetPath, PNG.sync.write(sheetPng));
        console.log(`✅ Generated ${char.id}.png spritesheet (480x120, 6 frames of 80x120)`);

        resolve();
      });
  });
}

// Placeholder for remaining character(s) (Amoy) until user uploads
function generatePlaceholder80(agentId, skinCol, hairCol, shirtCol, pantsCol) {
  const frameW = 80, frameH = 120;
  const sheetPng = new PNG({ width: frameW * 6, height: frameH });

  for (let f = 0; f < 6; f++) {
    const ox = f * frameW + 24;
    const oy = 28;

    for (let cy = 0; cy < 44; cy++) {
      for (let cx = 0; cx < 32; cx++) {
        const dstX = ox + cx;
        const dstY = oy + cy * 1.8;
        if (dstX >= 0 && dstX < sheetPng.width && dstY >= 0 && dstY < sheetPng.height) {
          const idx = (Math.floor(dstY) * sheetPng.width + dstX) * 4;
          if (cy < 12) {
            sheetPng.data[idx] = hairCol[0];
            sheetPng.data[idx + 1] = hairCol[1];
            sheetPng.data[idx + 2] = hairCol[2];
            sheetPng.data[idx + 3] = 255;
          } else if (cy < 22) {
            sheetPng.data[idx] = skinCol[0];
            sheetPng.data[idx + 1] = skinCol[1];
            sheetPng.data[idx + 2] = skinCol[2];
            sheetPng.data[idx + 3] = 255;
          } else if (cy < 34) {
            sheetPng.data[idx] = shirtCol[0];
            sheetPng.data[idx + 1] = shirtCol[1];
            sheetPng.data[idx + 2] = shirtCol[2];
            sheetPng.data[idx + 3] = 255;
          } else {
            sheetPng.data[idx] = pantsCol[0];
            sheetPng.data[idx + 1] = pantsCol[1];
            sheetPng.data[idx + 2] = pantsCol[2];
            sheetPng.data[idx + 3] = 255;
          }
        }
      }
    }
  }

  const outPath = path.join(__dirname, '..', 'public', 'assets', 'characters', `${agentId}.png`);
  fs.writeFileSync(outPath, PNG.sync.write(sheetPng));
  console.log(`✅ Generated standardized 80x120 placeholder for ${agentId}.png`);
}

async function main() {
  for (const char of CHARACTERS) {
    await processUserSprite(char);
  }

  // Only Amoy remaining as placeholder
  generatePlaceholder80('amoy', [255, 225, 195], [120, 45, 75], [236, 72, 153], [30, 41, 59]);

  console.log('--- ALL 8 SPRITESHEETS READY (7 CUSTOM USER SPRITES + 1 AMOY PENDING) ---');
}

main();
