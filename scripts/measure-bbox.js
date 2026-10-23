const fs = require('fs');
const { PNG } = require('pngjs');

const filepath = '/Applications/kantor-ai/public/assets/raw-frames/zekky/idle.png';
fs.createReadStream(filepath)
  .pipe(new PNG())
  .on('parsed', function() {
    let minX = this.width, maxX = 0, minY = this.height, maxY = 0;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const idx = (y * this.width + x) * 4;
        if (this.data[idx + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    console.log(`Bounding Box: [${minX}, ${minY}] to [${maxX}, ${maxY}]`);
    console.log(`Character size: ${maxX - minX + 1} x ${maxY - minY + 1}`);
  });
