/* Viewport-level teacher camera overlay. Loaded early and applied after the room code initializes. */
(function installTeacherCameraOverlay(){
  if(typeof TCB === 'undefined' || typeof tcbPlace !== 'function' || typeof tcbWire !== 'function'){
    setTimeout(installTeacherCameraOverlay, 50);
    return;
  }
  TCB_S[0]=58; TCB_S[1]=76; TCB_S[2]=96;

  function portal(){
    const cam=document.getElementById('crTcam'), stage=document.getElementById('crStage');
    if(cam&&stage) (document.fullscreenElement===stage?stage:document.body).appendChild(cam);
  }

  tcbPlace=function(){
    const cam=document.getElementById('crTcam');
    if(!cam||!document.getElementById('crOv')){if(cam)cam.style.display='none';return;}
    portal();
    const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
    const size=Math.round(Math.min(TCB_S[TCB.sz],w*.22,h*.22));
    const pos=TCB.pos||{x:.92,y:.12};
    TCB.pos={x:Math.max(0,Math.min(1,pos.x)),y:Math.max(0,Math.min(1,pos.y))};
    cam.style.display='block';
    cam.style.width=cam.style.height=size+'px';
    cam.style.left=Math.round(TCB.pos.x*(w-size))+'px';
    cam.style.top=Math.round(TCB.pos.y*(h-size))+'px';
  };

  tcbWire=function(cam){
    let drag=null; const clamp=n=>Math.max(0,Math.min(1,n));
    cam.addEventListener('pointerdown',e=>{
      TCB.pos||(TCB.pos={x:.92,y:.12});
      drag={x:e.clientX,y:e.clientY,px:TCB.pos.x,py:TCB.pos.y,mv:false};
      try{cam.setPointerCapture(e.pointerId)}catch{}
      e.preventDefault();e.stopPropagation();
    });
    cam.addEventListener('pointermove',e=>{
      if(!drag)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
      if(Math.abs(dx)+Math.abs(dy)>6)drag.mv=true;
      if(!drag.mv)return;
      TCB.pos={x:clamp(drag.px+dx/Math.max(1,innerWidth-cam.offsetWidth)),y:clamp(drag.py+dy/Math.max(1,innerHeight-cam.offsetHeight))};
      tcbPlace();
    });
    const done=()=>{if(drag){if(!drag.mv)TCB.sz=(TCB.sz+1)%3;if(TCB.pos)tcbSave();drag=null;}};
    cam.addEventListener('pointerup',done);
    cam.addEventListener('pointercancel',()=>{drag=null});
  };
  document.addEventListener('fullscreenchange',tcbPlace);
})();

// The lesson-notes shortcut is no longer shown in the live-room home card.
(function removeLessonNotesShortcut(){
  const remove=()=>document.querySelectorAll('button.kb-home, [data-act="kb_open"], [data-act="kb_frame"], .cr-cams-card').forEach(button=>button.remove());
  if(document.body){remove();new MutationObserver(remove).observe(document.body,{childList:true,subtree:true});}
  else document.addEventListener('DOMContentLoaded',()=>{remove();new MutationObserver(remove).observe(document.body,{childList:true,subtree:true});},{once:true});
})();

// Show each student's live camera in place of the pet avatar. Clicking it opens
// one movable, resizable floating preview for the teacher.
(function installStudentCameraPreviews(){
  if(typeof CR==='undefined' || typeof crPaint!=='function'){
    setTimeout(installStudentCameraPreviews,100);
    return;
  }
  const style=document.createElement('style');
  style.textContent='.cr-av.cr-av-live{overflow:hidden;cursor:grab;position:relative}.cr-av-live video{width:100%;height:100%;display:block;object-fit:cover;pointer-events:none}.cr-stu-float{position:fixed;z-index:99993;border-radius:50%;overflow:hidden;border:3px solid #fff;background:#0b0925;box-shadow:0 8px 24px #0000008c,0 0 0 3px #7c5cffa6;touch-action:none;cursor:grab;transition:width .18s,height .18s}.cr-stu-float:active{cursor:grabbing}.cr-stu-float video{width:100%;height:100%;display:block;object-fit:cover;pointer-events:none}.cr-stu-float b{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);background:#0b0925d9;color:#fff;padding:1px 7px;border-radius:99px;font-size:10px;white-space:nowrap}.cr-stu-float button{position:absolute;top:3px;left:3px;width:24px;height:24px;border:0;border-radius:50%;background:#17142dcc;color:#fff;cursor:pointer}';
  document.head.appendChild(style);
  const sizes=[72,96,124], states={};
  const stateFor=u=>states[u]||(states[u]=(()=>{try{return JSON.parse(localStorage.getItem('kx-stu-cam-'+u))||{x:.78,y:.2,sz:0}}catch{return{x:.78,y:.2,sz:0}}})());
  const save=(u,s)=>{try{localStorage.setItem('kx-stu-cam-'+u,JSON.stringify(s))}catch{}};
  function place(box,u){const s=stateFor(u),w=innerWidth,h=innerHeight,a=sizes[s.sz],x=Math.max(0,Math.min(1,s.x)),y=Math.max(0,Math.min(1,s.y));box.style.width=box.style.height=a+'px';box.style.left=Math.round(x*(w-a))+'px';box.style.top=Math.round(y*(h-a))+'px';}
  function open(u){const st=CR.stu[u];if(!st||!st.camStream)return;let box=document.getElementById('crStuFloat');if(box)box.remove();box=document.createElement('div');box.id='crStuFloat';box.className='cr-stu-float';box.innerHTML='<video autoplay muted playsinline></video><b></b><button type="button" aria-label="إغلاق">×</button>';document.body.appendChild(box);const v=box.querySelector('video');v.srcObject=st.camStream;v.play().catch(()=>{});box.querySelector('b').textContent=st.n||'طالب';box.querySelector('button').onclick=e=>{e.stopPropagation();box.remove()};place(box,u);let drag=null;box.addEventListener('pointerdown',e=>{if(e.target.tagName==='BUTTON')return;const s=stateFor(u);drag={x:e.clientX,y:e.clientY,px:s.x,py:s.y,mv:false};try{box.setPointerCapture(e.pointerId)}catch{}e.preventDefault()});box.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.abs(dx)+Math.abs(dy)>6)drag.mv=true;if(!drag.mv)return;const a=box.offsetWidth,s=stateFor(u);s.x=Math.max(0,Math.min(1,drag.px+dx/Math.max(1,innerWidth-a)));s.y=Math.max(0,Math.min(1,drag.py+dy/Math.max(1,innerHeight-a)));place(box,u)});const done=()=>{if(!drag)return;const s=stateFor(u);if(!drag.mv)s.sz=(s.sz+1)%sizes.length;save(u,s);place(box,u);drag=null};box.addEventListener('pointerup',done);box.addEventListener('pointercancel',()=>{drag=null})}
  function sync(){
    if(CR.role!=='t')return;
    document.querySelectorAll('.cr-cams-card').forEach(e=>e.remove());
    Object.values(CR.stu).forEach(st=>{
      const button=[...document.querySelectorAll('.cr-r button[data-u]')].find(e=>e.dataset.u===st.u),row=button&&button.closest('.cr-r'),avatar=row&&row.querySelector('.cr-av');
      if(!avatar||!st.camOn||!st.camStream)return;
      avatar.classList.add('cr-av-live');let v=avatar.querySelector('video');if(!v){v=document.createElement('video');v.autoplay=true;v.muted=true;v.playsInline=true;avatar.replaceChildren(v);avatar.onclick=()=>open(st.u)}if(v.srcObject!==st.camStream){v.srcObject=st.camStream;v.play().catch(()=>{})}
    });
  }
  new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
  setInterval(sync,500);
  addEventListener('resize',()=>{const b=document.getElementById('crStuFloat');if(b){const st=Object.values(CR.stu).find(s=>s.camStream&&b.querySelector('b')?.textContent===s.n);st&&place(b,st.u)}});
  if(typeof crWbFull==='function'){
    const nativeWb=crWbFull;
    crWbFull=function(on){if(on&&((matchMedia&&matchMedia('(pointer:coarse)').matches)||innerWidth<700)){CR.wbFull=true;CR.wbReal=0;document.documentElement.classList.add('wbf-on');crPaint();return}nativeWb(on)};
  }
})();
