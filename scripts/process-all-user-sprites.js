const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const UPLOADS = [
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
  }
];

function isMagenta(r, g, b) {
  // Target: R=241, G=6, B=251
  return (r > 170 && b > 170 && g < 70) || (r > 200 && b > 200 && g < 100);
}

async function processSprite(item) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(item.file)
      .pipe(new PNG())
      .on('parsed', function() {
        console.log(`Processing ${item.id}: ${this.width}x${this.height}`);

        const numCols = 4;
        const numRows = 7;
        const cellW = Math.floor(this.width / numCols);
        const cellH = Math.floor(this.height / numRows);

        // First pass: remove magenta background on whole sheet
        for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
            const idx = (y * this.width + x) * 4;
            const r = this.data[idx];
            const g = this.data[idx + 1];
            const b = this.data[idx + 2];
            if (isMagenta(r, g, b)) {
              this.data[idx + 3] = 0; // Transparent
            }
          }
        }

        // Save raw full transparent sheet
        const fullSheetPath = path.join(__dirname, '..', 'public', 'assets', 'characters', `${item.id}_sheet.png`);
        fs.writeFileSync(fullSheetPath, PNG.sync.write(this));

        // Save individual action frames for column 0 (front-left isometric):
        // Row 0: idle
        // Row 1: typing
        // Row 2: walk1
        // Row 3: walk2
        // Row 4: walk3
        // Row 5: walk4
        // Row 6: sitting
        const actions = [
          { row: 0, name: 'idle' },
          { row: 1, name: 'typing' },
          { row: 2, name: 'walk1' },
          { row: 3, name: 'walk2' },
          { row: 4, name: 'walk3' },
          { row: 5, name: 'walk4' },
          { row: 6, name: 'sit' },
        ];

        const charRawDir = path.join(__dirname, '..', 'public', 'assets', 'raw-frames', item.id);
        if (!fs.existsSync(charRawDir)) fs.mkdirSync(charRawDir, { recursive: true });

        // Extract individual action frames
        const extractedFrames = [];
        actions.forEach((act) => {
          const framePng = new PNG({ width: cellW, height: cellH });
          const startX = 0; // Col 0
          const startY = act.row * cellH;

          for (let cy = 0; cy < cellH; cy++) {
            for (let cx = 0; cx < cellW; cx++) {
              const srcIdx = ((startY + cy) * this.width + (startX + cx)) * 4;
              const dstIdx = (cy * cellW + cx) * 4;
              framePng.data[dstIdx] = this.data[srcIdx];
              framePng.data[dstIdx + 1] = this.data[srcIdx + 1];
              framePng.data[dstIdx + 2] = this.data[srcIdx + 2];
              framePng.data[dstIdx + 3] = this.data[srcIdx + 3];
            }
          }

          const outPath = path.join(charRawDir, `${act.name}.png`);
          fs.writeFileSync(outPath, PNG.sync.write(framePng));
          extractedFrames.push({ name: act.name, png: framePng });
        });

        // Also build a clean 6-frame spritesheet for game animation:
        // Frame 0: Idle (Row 0, Col 0)
        // Frame 1: Breath (Idle with 1px offset or Row 0)
        // Frame 2: Walk 1 (Row 2, Col 0)
        // Frame 3: Walk 2 (Row 3, Col 0)
        // Frame 4: Typing (Row 1, Col 0)
        // Frame 5: Sit / Alert (Row 6, Col 0)
        const targetFrames = [0, 0, 2, 3, 1, 6]; // indices into actions
        const sheet6 = new PNG({ width: cellW * 6, height: cellH });

        targetFrames.forEach((actIdx, f) => {
          const act = actions[actIdx];
          const startX = 0; // Col 0
          const startY = act.row * cellH;

          for (let cy = 0; cy < cellH; cy++) {
            for (let cx = 0; cx < cellW; cx++) {
              const srcIdx = ((startY + cy) * this.width + (startX + cx)) * 4;
              const dstIdx = (cy * (cellW * 6) + (f * cellW + cx)) * 4;
              sheet6.data[dstIdx] = this.data[srcIdx];
              sheet6.data[dstIdx + 1] = this.data[srcIdx + 1];
              sheet6.data[dstIdx + 2] = this.data[srcIdx + 2];
              sheet6.data[dstIdx + 3] = this.data[srcIdx + 3];
            }
          }
        });

        const targetSheetPath = path.join(__dirname, '..', 'public', 'assets', 'characters', `${item.id}.png`);
        fs.writeFileSync(targetSheetPath, PNG.sync.write(sheet6));

        console.log(`✅ Saved ${item.id} spritesheet (${cellW * 6}x${cellH}, frameW=${cellW}, frameH=${cellH}) to ${targetSheetPath}`);
        resolve({ cellW, cellH });
      });
  });
}

async function run() {
  for (const item of UPLOADS) {
    await processSprite(item);
  }
  console.log('All user sprites processed successfully!');
}

run();
