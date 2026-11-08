// يستخرج كلمات حفص كما يراها التسميع (نفس normalizeTasmeeWord) إلى hafs_words.json
// الاستعمال: node tools/export_hafs_words.js [المخرج=hafs_words.json]
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const fnSrc = app.slice(app.indexOf('function normalizeTasmeeWord'), app.indexOf('function tasmeeWordDistance'));
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'data.js'), 'utf8'), ctx);
vm.runInContext(fnSrc + ';this.__n = normalizeTasmeeWord;', ctx);
const D = vm.runInContext('D', ctx);
const out = D.texts.map(surah => surah.map(text => text.split(/\s+/).map(w => ctx.__n(w)).filter(Boolean)));
fs.writeFileSync(process.argv[2] || 'hafs_words.json', JSON.stringify(out));
