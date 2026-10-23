const fs = require('fs');
const { PNG } = require('pngjs');

const filepath = '/Users/mymac/.gemini/antigravity-ide/brain/dbe5333f-1f35-4b86-9255-677d77684061/.user_uploaded/media_1792764593711.png';

fs.createReadStream(filepath)
  .pipe(new PNG())
  .on('parsed', function() {
    console.log(`Dimensions: ${this.width} x ${this.height}`);
    // Check top-left corner pixel color
    const idx = 0;
    console.log(`Top-left pixel: R=${this.data[idx]}, G=${this.data[idx+1]}, B=${this.data[idx+2]}, A=${this.data[idx+3]}`);
  });
