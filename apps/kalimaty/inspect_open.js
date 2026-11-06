const fs = require('fs');
const content = fs.readFileSync('c:\\Users\\El-Hakm\\Desktop\\kalimaty\\Kalimaty.html', 'utf8');

const pcIdx = content.indexOf('function petChatCard');
console.log(content.substring(pcIdx - 3000, pcIdx));
