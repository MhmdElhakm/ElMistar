const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'Kalimaty.html');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add .kt-chat-btn CSS into the styles
const cssTarget = `<style id="pc-css">`;
const cssToAdd = `<style id="pc-css">
.kt-chat-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:48px;padding:0 20px;border-radius:18px;font-weight:800;font-size:16px;background:linear-gradient(135deg,rgba(150,134,255,.2),rgba(99,80,224,.12));border:1.5px solid rgba(150,134,255,.38);color:#fff;box-shadow:0 6px 18px -4px rgba(109,87,230,.3);cursor:pointer;transition:transform .12s,background .15s,border-color .15s,box-shadow .15s;margin-top:4px}
.kt-chat-btn:hover{background:linear-gradient(135deg,rgba(150,134,255,.3),rgba(99,80,224,.2));border-color:var(--primary);box-shadow:0 8px 24px -4px rgba(109,87,230,.45)}
.kt-chat-btn:active{transform:scale(.98);background:rgba(150,134,255,.35)}
.kt-chat-btn .ic{width:1.3em;height:1.3em;color:var(--primary)}`;

if (content.includes(cssTarget)) {
  content = content.replace(cssTarget, cssToAdd);
  console.log('1. Added .kt-chat-btn CSS.');
}

// 2. Add the button to kxTrainPet in the Training tab
const trainChipsTarget = `<div class="kt-chips"><span class="chip2" title="طعام">\${ICO.apple}\${p.food}</span><span class="chip2" title="عملات">\${ICO.coin}\${p.coins}</span><span class="chip2" title="طاقة المغامرة">\${ICO.bolt}\${p.adv?p.adv.tok:0}</span></div>
   </div></section>`;

const trainChipsReplacement = `<div class="kt-chips"><span class="chip2" title="طعام">\${ICO.apple}\${p.food}</span><span class="chip2" title="عملات">\${ICO.coin}\${p.coins}</span><span class="chip2" title="طاقة المغامرة">\${ICO.bolt}\${p.adv?p.adv.tok:0}</span></div>
    \${full?\`<button class="kt-chat-btn" data-pc="open">\${ic('speaker')} ابدأ المحادثة مع \${esc(p.name)}</button>\`:''}
   </div></section>`;

if (!content.includes(trainChipsTarget)) {
  console.error('ERROR: trainChipsTarget not found!');
  process.exit(1);
}
content = content.replace(trainChipsTarget, trainChipsReplacement);
console.log('2. Button added to kxTrainPet in Training tab.');

// 3. Remove the button from petChatCard in Settings tab (since it has moved to Training tab)
const oldPetChat = `function petChatCard(){
  const p=pet(),v=pcv();
  return \`<div class="card tvc pcc"><div class="tvh"><div><h3>التحدث مع حيوانك</h3><small>محادثة إنجليزية بسيطة وهو يردّ عليك</small></div><div class="tvav pcc-av">\${p?petSvg({sp:p.sp,color:p.color,stage:petStage(),exp:'happy',eq:p.eq,w:48}):''}</div></div>
   \${p?\`<button class="pcc-btn" data-pc="open">\${ic('speaker')} ابدأ المحادثة مع \${esc(p.name)}</button>\`:\`<div class="tvhint">اختر حيوانك الأليف أولًا من قسم التدريب لتتحدث معه.</div><button class="pcc-btn" data-pc="gopet">اختيار حيوان</button>\`}
   <div class="tvrow"><b>صوت الحيوان</b><div class="seg pcc-seg">\${PCV.map(x=>\`<button class="\${v.k===x.k?'on':''}" data-pc="voice" data-v="\${x.k}">\${x.n}</button>\`).join('')}</div></div>
   <div class="tvhint">\${SR?'اضغط الميكروفون وتحدّث بالإنجليزية، أو اكتب رسالتك.':'متصفحك لا يدعم التعرّف على الصوت، يمكنك الكتابة بدلًا منه.'}</div></div>\`;
}`;

const newPetChat = `function petChatCard(){
  const p=pet(),v=pcv();
  return \`<div class="card tvc pcc"><div class="tvh"><div><h3>التحدث مع حيوانك</h3><small>محادثة إنجليزية بسيطة وهو يردّ عليك</small></div><div class="tvav pcc-av">\${p?petSvg({sp:p.sp,color:p.color,stage:petStage(),exp:'happy',eq:p.eq,w:48}):''}</div></div>
   <div class="tvrow"><b>صوت الحيوان</b><div class="seg pcc-seg">\${PCV.map(x=>\`<button class="\${v.k===x.k?'on':''}" data-pc="voice" data-v="\${x.k}">\${x.n}</button>\`).join('')}</div></div>
   <div class="tvhint">\${SR?'تستطيع التحدث مع حيوانك في أي وقت من تبويب التدريب بالضغط على «ابدأ المحادثة».':'متصفحك لا يدعم التعرّف على الصوت، يمكنك الكتابة بدلًا منه.'}</div></div>\`;
}`;

if (content.includes(oldPetChat)) {
  content = content.replace(oldPetChat, newPetChat);
  console.log('3. Cleaned petChatCard in Settings tab.');
}

// Save safely
const tempPath = path.join(__dirname, 'Kalimaty.tmp.html');
fs.writeFileSync(tempPath, content, 'utf8');

const stat = fs.statSync(tempPath);
if (stat.size < 19000000) {
  console.error('File size too small! Aborting.');
  process.exit(1);
}

fs.copyFileSync(tempPath, filePath);
fs.unlinkSync(tempPath);

console.log('SUCCESS! Button successfully moved to Training tab under the animal.');
