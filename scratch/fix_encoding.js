const fs = require('fs');
const path = 'c:\\Users\\almaz\\Desktop\\paracetamol.haze\\src\\data\\movies.ts';

try {
    const buffer = fs.readFileSync(path);
    // Convert to UTF-8 and filter out invalid sequences
    const cleanStr = buffer.toString('utf8');
    fs.writeFileSync(path, cleanStr, 'utf8');
    console.log('Successfully cleaned src/data/movies.ts encoding');
} catch (e) {
    console.error('Error cleaning file:', e);
    process.exit(1);
}
