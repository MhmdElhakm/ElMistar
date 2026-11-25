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
