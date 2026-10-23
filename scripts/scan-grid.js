const fs = require('fs');
const { PNG } = require('pngjs');

const filepath = '/Applications/kantor-ai/public/assets/characters/zekky_sheet.png';

fs.createReadStream(filepath)
  .pipe(new PNG())
  .on('parsed', function() {
    console.log(`Image size: ${this.width} x ${this.height}`);

    // Divide into 4 columns and 7 rows
    const colW = this.width / 4;
    const rowH = this.height / 7;

    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 4; c++) {
        const x0 = Math.floor(c * colW);
        const x1 = Math.floor((c + 1) * colW);
        const y0 = Math.floor(r * rowH);
        const y1 = Math.floor((r + 1) * rowH);

        let minX = x1, maxX = x0, minY = y1, maxY = y0;
        let count = 0;

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const idx = (y * this.width + x) * 4;
            if (this.data[idx + 3] > 10) {
              count++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (count > 0) {
          console.log(`Row ${r}, Col ${c}: count=${count}, bbox=[${minX}, ${minY}] to [${maxX}, ${maxY}], size=${maxX - minX + 1}x${maxY - minY + 1}`);
        }
      }
    }
  });
