/* Toi Online: общее для гостя, экрана, пульта и альбома. Шаблоны, орнамент кодом (шырдак/текемет), тема, утилиты. */
(function(){
const TAU=Math.PI*2;
const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n||0).toLocaleString('ru-RU').replace(/[   ,]/g,' ')+' ₸';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- шаблоны экрана ---------- */
const TPL={
  pink:   {layout:'medallion',grad:'radial',bg1:'#ee4fd8',bg2:'#a4116f',mode:'outline',c1:'#b8122f',a1:1,c2:'#fff1f7',acc:'#ffd979',n:8},
  gold:   {layout:'corners',  grad:'radial',bg1:'#fffaf0',bg2:'#f1e0c2',mode:'gold',   c1:'#d6ad55',a1:1,acc:'#b8862c'},
  bluemed:{layout:'medallion',grad:'linear',bg1:'#f4f9ff',bg2:'#2a7cc2',mode:'flat',   c1:'#5aa0dc',a1:.55,acc:'#c99331',n:8},
  turq:   {layout:'tile',     grad:'radial',bg1:'#63cfca',bg2:'#1c8088',mode:'emboss', c1:'#55c0bc',a1:1,acc:'#fff0c4'},
  green:  {layout:'medallion',grad:'radial',bg1:'#17a356',bg2:'#0b6533',mode:'outline',c1:'#0e3b29',a1:1,c2:'#d8c9a5',acc:'#f6dc96',n:4},
  royal:  {layout:'tile',     grad:'radial',bg1:'#2470e0',bg2:'#0c3a96',mode:'flat',   c1:'#6cbcf5',a1:.8,acc:'#ffe28f'},
  circle: {layout:'circle',   grad:'radial',bg1:'#ffffff',bg2:'#f2e8d6',mode:'gold',   c1:'#c9994a',a1:1,acc:'#b07f2a'},
  sky:    {layout:'tile',     grad:'radial',bg1:'#d8eafa',bg2:'#a8c9ea',mode:'flat',   c1:'#ffffff',a1:.6,acc:'#c08a2a'},
};
const TPL_NAMES={pink:'Розовый медальон',gold:'Золотые углы',bluemed:'Голубой медальон',turq:'Бирюзовый шырдак',green:'Зелёный текемет',royal:'Синий узор',circle:'Золотой круг',sky:'Нежно-голубой'};
const FONTS=[["'Great Vibes', cursive",'Каллиграфия'],["'Cormorant Garamond', serif",'Классика'],["'Playfair Display', serif",'Торжественный'],["'Forum', serif",'Старинный'],["'Lobster', cursive",'Яркий'],["'Comfortaa', sans-serif",'Детский']];
const PRESETS={
  wedding:{title:'Свадьба',tpl:'pink',kind:'Үйлену тойы',names:'Диас & Диара',sub:'Шаңырақтарың биік болсын!',font:"'Great Vibes', cursive",size:'9cqw',
    quick:['Құтты болсын!','Бақытты болыңдар!','Шаңырақтарың биік болсын!','Махаббат пен бақыт тілеймін!'],
    hello:'Поздравьте молодых! Ваше поздравление появится на большом экране в зале.',who:'молодые'},
  jubilee:{title:'Юбилей',tpl:'green',kind:'Мерейтой',names:'Серік ата · 60',sub:'Мерейтойыңыз құтты болсын!',font:"'Cormorant Garamond', serif",size:'8.4cqw',
    quick:['Мерейтойыңыз құтты болсын!','Зор денсаулық тілеймін!','Ұзақ ғұмыр, бақуат өмір!'],
    hello:'Поздравьте юбиляра! Ваше поздравление появится на большом экране в зале.',who:'юбиляр'},
  uzatu:{title:'Қыз ұзату',tpl:'circle',kind:'Қыз ұзату',names:'Аружан',sub:'Ақ жол, қарындасым!',font:"'Forum', serif",size:'9.5cqw',
    quick:['Ақ жол!','Бақытты бол, қарағым!','Жолың ашық болсын!'],
    hello:'Пожелайте невесте ақ жол! Ваше поздравление появится на большом экране.',who:'невеста'},
  tusau:{title:'Тұсаукесер',tpl:'sky',kind:'Тұсаукесер',names:'Алихан · 1 жас',sub:'Қадамың құтты болсын!',font:"'Comfortaa', sans-serif",size:'7.6cqw',
    quick:['Қадамың құтты болсын!','Өсіп-өн, балапан!','Денсаулық тілейміз!'],
    hello:'Поздравьте малыша с первыми шагами! Поздравление появится на большом экране.',who:'родители'},
};
/* Настройки мероприятия с сервера + геометрия шаблона. Цвета, выбранные организатором, важнее цветов шаблона. */
function full(cfg){
  const p=PRESETS[cfg.type]||PRESETS.wedding,t=TPL[cfg.tpl]||TPL[p.tpl];
  const c={...p,...t};
  for(const k in cfg)if(cfg[k]!==undefined&&cfg[k]!==null&&cfg[k]!=='')c[k]=cfg[k];
  if(!Array.isArray(c.quick)||!c.quick.length)c.quick=p.quick;
  return c;
}
function preset(type){const p=PRESETS[type]||PRESETS.wedding,t=TPL[p.tpl];
  return {type,tpl:p.tpl,kind:p.kind,names:p.names,sub:p.sub,font:p.font,size:p.size,quick:p.quick.slice(),hello:p.hello,bg1:t.bg1,bg2:t.bg2,c1:t.c1,acc:t.acc};}

/* ---------- цвета ---------- */
const hex2=h=>{const n=parseInt(h.slice(1),16);return [n>>16&255,n>>8&255,n&255];};
const mix=(a,b,t)=>{const A=hex2(a),B=hex2(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('');};
const rgba=(h,a)=>{const [r,g,b]=hex2(h);return `rgba(${r},${g},${b},${a})`;};
function lum(h){const f=c=>(c/=255)<=.03928?c/12.92:((c+.055)/1.055)**2.4;const [r,g,b]=hex2(h);return .2126*f(r)+.7152*f(g)+.0722*f(b);}

/* ---------- орнамент: геометрия ---------- */
const Col=()=>({S:[],F:[]});
function mk(cx,cy,rot,sc){const c=Math.cos(rot),s=Math.sin(rot);return (x,y)=>[cx+(x*c-y*s)*sc,cy+(x*s+y*c)*sc];}
function hornG(col,cx,cy,size,rot,o={}){ // «қошқар мүйіз»: ножка и два рога-спирали
  const P=mk(cx,cy,rot,size),T=(o.turns||1.15)*TAU,p=new Path2D();
  p.moveTo(...P(0,o.stem??.12));p.lineTo(...P(0,-.5));
  for(const sg of [1,-1]){p.moveTo(...P(0,-.5));for(let t=.06;t<=T;t+=.06){const a=sg>0?Math.PI+t:-t,R=.36*(1-.8*t/T);p.lineTo(...P(sg*.36+R*Math.cos(a),-.5+R*Math.sin(a)));}}
  col.S.push({p,w:size*(o.w||.12)});
  if(o.tip!==false){const f=new Path2D();f.moveTo(...P(0,-1));f.quadraticCurveTo(...P(.17,-.76),...P(0,-.57));f.quadraticCurveTo(...P(-.17,-.76),...P(0,-1));col.F.push(f);}
}
function dropG(col,cx,cy,len,rot){const P=mk(cx,cy,rot,len),f=new Path2D();f.moveTo(...P(0,-1));f.quadraticCurveTo(...P(.34,-.42),...P(0,0));f.quadraticCurveTo(...P(-.34,-.42),...P(0,-1));col.F.push(f);}
function dotG(col,cx,cy,r){const f=new Path2D();f.arc(cx,cy,r,0,TAU);col.F.push(f);}
function spiralG(col,P,sx,sy,cx,cy,sign,turns,w){
  const R0=Math.hypot(sx-cx,sy-cy),a0=Math.atan2(sy-cy,sx-cx),T=turns*TAU,p=new Path2D();p.moveTo(...P(sx,sy));
  for(let t=.06;t<=T;t+=.06){const a=a0+sign*t,R=R0*(1-.8*t/T);p.lineTo(...P(cx+R*Math.cos(a),cy+R*Math.sin(a)));}
  col.S.push({p,w});
}
function medallionG(col,cx,cy,r,n){
  const hs=r*(n>=8?.4:.55);
  for(let i=0;i<n;i++){const a=i*TAU/n;hornG(col,cx+Math.sin(a)*r*.42,cy-Math.cos(a)*r*.42,hs,a);}
  for(let i=0;i<n;i++){const a=(i+.5)*TAU/n;dropG(col,cx+Math.sin(a)*r*.6,cy-Math.cos(a)*r*.6,r*.22,a);}
  for(let i=0;i<4;i++){const a=i*Math.PI/2+Math.PI/4;dropG(col,cx+Math.sin(a)*r*.06,cy-Math.cos(a)*r*.06,r*.2,a);}
  dotG(col,cx,cy,r*.05);
}
function crossG(col,cx,cy,s){for(let i=0;i<4;i++){const a=i*Math.PI/2;hornG(col,cx+Math.sin(a)*s*.25,cy-Math.cos(a)*s*.25,s*.6,a,{tip:false,turns:.9});}dotG(col,cx,cy,s*.1);}
function tileG(col,W,H,cell){
  for(let y=-cell;y<H+cell;y+=cell)for(let x=-cell;x<W+cell;x+=cell){medallionG(col,x,y,cell*.47,4);crossG(col,x+cell/2,y+cell/2,cell*.3);}
}
function cornerG(col,cx,cy,S,rot){
  const P0=mk(cx,cy,rot,S);
  for(const sw of [false,true]){
    const P=sw?(a,b)=>P0(b,a):P0,w=S*.04;
    const v=new Path2D();v.moveTo(...P(.14,.05));v.bezierCurveTo(...P(.4,.01),...P(.7,.09),...P(1.02,.035));col.S.push({p:v,w});
    [[.42,.12,1],[.66,.09,1],[.88,.065,1]].forEach(([x,R,sg])=>spiralG(col,P,x,.045,x,.045+R,sw?-sg:sg,1.15,w));
    const f=new Path2D();f.moveTo(...P(1.14,.03));f.quadraticCurveTo(...P(1.06,.07),...P(1.0,.035));f.quadraticCurveTo(...P(1.06,0),...P(1.14,.03));col.F.push(f);
    const d=new Path2D();d.moveTo(...P(.55,-.0));d.quadraticCurveTo(...P(.58,.1),...P(.53,.17));d.quadraticCurveTo(...P(.49,.1),...P(.55,-.0));col.F.push(d);
  }
  hornG(col,...P0(.27,.27),S*.44,rot-Math.PI/4,{w:.1});
  dropG(col,...P0(.5,.5),S*.16,rot+3*Math.PI/4);
}
function ringG(col,cx,cy,R){
  [1,.84].forEach(k=>{const p=new Path2D();p.arc(cx,cy,R*k,0,TAU);col.S.push({p,w:R*.02});});
  const P=(x,y)=>[x,y],n=30;
  for(let k=0;k<n;k++){const t=k*TAU/n,c=Math.cos(t),s=Math.sin(t);spiralG(col,P,cx+c*R*.985,cy+s*R*.985,cx+c*R*.92,cy+s*R*.92,1,1.05,R*.018);}
  medallionG(col,cx,cy,R*.78,8);
}

/* ---------- орнамент: покраска ---------- */
function paint(x,col,t,W,H){
  x.lineCap='round';x.lineJoin='round';
  const aw=col.S.length?col.S.reduce((s,a)=>s+a.w,0)/col.S.length:4;
  const draw=(style,k,dx,dy)=>{x.save();x.translate(dx||0,dy||0);x.strokeStyle=x.fillStyle=style;
    for(const s of col.S){x.lineWidth=s.w*(1+k);x.stroke(s.p);}
    for(const f of col.F){x.fill(f);if(k){x.lineWidth=aw*k;x.stroke(f);}}x.restore();};
  const c1=rgba(t.c1,t.a1??1);
  if(t.mode==='outline'){draw(t.c2||'#ffffff',.85);draw(c1,0);}
  else if(t.mode==='emboss'){const o=Math.max(1,aw*.16);draw('rgba(0,0,0,.2)',0,o,o);draw('rgba(255,255,255,.45)',0,-o,-o);draw(c1,0);}
  else if(t.mode==='gold'){
    const g=x.createLinearGradient(0,0,W,H),d=mix(t.c1,'#3a2400',.35),l=mix(t.c1,'#ffffff',.5);
    [[0,d],[.25,l],[.45,t.c1],[.6,l],[.8,t.c1],[1,d]].forEach(([o,c])=>g.addColorStop(o,c));
    x.save();x.shadowColor='rgba(70,40,0,.3)';x.shadowBlur=aw*.8;x.shadowOffsetY=aw*.25;draw(g,0);x.restore();
  } else draw(c1,0);
}
function fitCanvas(cv){if(!cv)return null;const r=cv.getBoundingClientRect(),d=devicePixelRatio||1;if(!r.width)return null;cv.width=Math.round(r.width*d);cv.height=Math.round(r.height*d);const x=cv.getContext('2d');x.setTransform(d,0,0,d,0,0);return [x,r.width,r.height];}
/* Боковые узоры LED-экрана */
function renderBand(cv,c){
  const fb=fitCanvas(cv);if(!fb)return;const [x,W,H]=fb,col=Col();
  if(c.layout==='medallion'){medallionG(col,0,H/2,H*.6,c.n||8);medallionG(col,W,H/2,H*.6,c.n||8);[[0,0],[W,0],[0,H],[W,H]].forEach(([a,b])=>medallionG(col,a,b,H*.28,4));}
  else if(c.layout==='corners'){const S=H*.52;cornerG(col,0,0,S,0);cornerG(col,W,0,S,Math.PI/2);cornerG(col,W,H,S,Math.PI);cornerG(col,0,H,S,-Math.PI/2);}
  else if(c.layout==='tile')tileG(col,W,H,H/3.1);
  else {const S=H*.34;cornerG(col,0,0,S,0);cornerG(col,W,0,S,Math.PI/2);cornerG(col,W,H,S,Math.PI);cornerG(col,0,H,S,-Math.PI/2);}
  paint(x,col,c,W,H);
}
/* Центральный медальон (вращается) */
function renderRose(rc,c){
  if(!rc)return;const rx=rc.getContext('2d');rx.setTransform(1,0,0,1,0,0);rx.clearRect(0,0,900,900);
  const show=c.layout==='medallion'||c.layout==='circle';rc.style.display=show?'':'none';
  if(show){const col=Col();if(c.layout==='circle')ringG(col,450,450,430);else medallionG(col,450,450,430,c.n||8);paint(rx,col,c,900,900);rc.style.opacity=c.layout==='circle'?.9:(c.n===4?.5:.85);}
}
/* Узор в шапке телефона гостя */
function renderHeadOrn(cv,c){
  const fp=fitCanvas(cv);if(!fp)return;const [x,W,H]=fp,col=Col();
  if(c.layout==='corners'||c.layout==='circle'){const S=H*.8;cornerG(col,0,0,S,0);cornerG(col,W,0,S,Math.PI/2);cornerG(col,W,H,S,Math.PI);cornerG(col,0,H,S,-Math.PI/2);}
  else tileG(col,W,H,H*.95);
  x.globalAlpha=.75;paint(x,col,c,W,H);
}
/* CSS-переменные праздника на элементе + фон */
function theme(el,c){
  const mid=c.grad==='linear'?mix(c.bg1,c.bg2,.35):c.bg1,ink=lum(mix(mid,c.bg2,.3))>.33?'#3a2430':'#fff6e8';
  const bg=c.grad==='linear'?`linear-gradient(90deg,${c.bg2} 0%,${mix(c.bg2,c.bg1,.55)} 55%,${c.bg1} 100%)`:`radial-gradient(ellipse at 50% 45%,${c.bg1} 0%,${mix(c.bg1,c.bg2,.6)} 55%,${c.bg2} 100%)`;
  const st=el.style,light=ink!=='#fff6e8';
  st.setProperty('--ev-bg',mid);st.setProperty('--ev-halo',mid);st.setProperty('--ev-acc',c.acc);st.setProperty('--ev-ink',ink);
  st.setProperty('--ev-font',c.font);st.setProperty('--ev-size',c.size||'8cqw');st.setProperty('--ev-grad',bg);
  st.setProperty('--ev-g3',mix(c.acc,'#ffffff',light?.12:.45));st.setProperty('--ev-gpk',mix(c.acc,'#ffffff',light?.4:.85));
  st.setProperty('--sheen',c.sheen||'30s');
  return {bg,mid,ink};
}

/* ---------- картинки ---------- */
/* Сжимаем фото в браузере до max px по длинной стороне. createImageBitmap сам поворачивает фото с телефона по EXIF. */
async function readImg(file,max,q){
  let src;
  try{src=await createImageBitmap(file,{imageOrientation:'from-image'});}
  catch(e){src=await new Promise((ok,no)=>{const u=URL.createObjectURL(file),i=new Image();i.onload=()=>ok(i);i.onerror=()=>no(new Error('Не получилось открыть фото'));i.src=u;});}
  const w=src.width,h=src.height,k=Math.min(1,max/Math.max(w,h)),c=document.createElement('canvas');
  c.width=Math.round(w*k);c.height=Math.round(h*k);c.getContext('2d').drawImage(src,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',q||.85);
}
function hueOf(s){let h=0;for(const ch of s)h=(h*31+ch.charCodeAt(0))%360;return h;}
const avCache={};
function avatar(name){
  name=name||'Гость';if(avCache[name])return avCache[name];
  const h=hueOf(name),c=document.createElement('canvas');c.width=c.height=360;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,360,360);g.addColorStop(0,`hsl(${h},45%,55%)`);g.addColorStop(1,`hsl(${(h+40)%360},50%,28%)`);x.fillStyle=g;x.fillRect(0,0,360,360);
  const col=Col();medallionG(col,180,180,200,8);paint(x,col,{mode:'flat',c1:'#ffffff',a1:.16},360,360);
  x.fillStyle='#fff7e6';x.font='700 130px Manrope, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText((name.trim()[0]||'?').toUpperCase(),180,190);
  return avCache[name]=c.toDataURL('image/jpeg',.85);
}
const photoOf=card=>card.photo||avatar(card.name);

/* ---------- правила показа ---------- */
/* Обычная открытка 8 сек, конверт 15 сек + 2 сек за каждую 1 000 ₸, не больше 60 */
const durOf=v=>v?Math.min(60,15+Math.floor(v/1000)*2):8;

/* ---------- QR ---------- */
function loadQR(){return window.qrcode?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement('script');s.src='/static/qrcode.js';s.onload=ok;s.onerror=no;document.head.appendChild(s);});}
async function drawQR(cv,text,k,fg,bg){
  await loadQR();const q=qrcode(0,'M');q.addData(text);q.make();const n=q.getModuleCount(),m=2;k=k||8;
  cv.width=cv.height=(n+m*2)*k;const x=cv.getContext('2d');x.fillStyle=bg||'#fff';x.fillRect(0,0,cv.width,cv.height);x.fillStyle=fg||'#111';
  for(let r=0;r<n;r++)for(let c=0;c<n;c++)if(q.isDark(r,c))x.fillRect((c+m)*k,(r+m)*k,k,k);
}

/* ---------- сеть ---------- */
async function api(url,body,headers){
  const o=body===undefined?{headers:headers||{}}:{method:'POST',headers:{'Content-Type':'application/json',...(headers||{})},body:JSON.stringify(body)};
  const r=await fetch(url,o);let j={};try{j=await r.json();}catch(e){}
  if(!r.ok)throw new Error(j.error||('Ошибка '+r.status));
  return j;
}
const abs=p=>location.origin+p;
const tm=t=>new Date(t).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Almaty'});

window.TOI={$,fmt,esc,reduce,TPL,TPL_NAMES,FONTS,PRESETS,full,preset,mix,rgba,lum,Col,medallionG,paint,renderBand,renderRose,renderHeadOrn,theme,
  readImg,avatar,photoOf,durOf,drawQR,api,abs,tm,fitCanvas};
})();
