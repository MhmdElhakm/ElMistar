const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\El-Hakm\\Desktop\\kalimaty\\Kalimaty.html', 'utf8');

const sIdx = content.indexOf('.pscene{');
console.log(content.substring(sIdx, sIdx + 800));
