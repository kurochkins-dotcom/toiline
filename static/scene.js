/* Сцена LED-экрана по эскизам 6–8б: заставка-шаблон, бесплатное (полароид с плёнкой), Premium (рамка).
   Рисуем на холсте 1600×900 и масштабируем под экран. Используют экран и превью в кабинете. */
(function(){
const T=window.TOI,W=1600,H=900;
// золотой конвертик рядом с суммой (Premium больше 990 ₸)
const ENV='<svg class="env" viewBox="0 0 56 40" aria-hidden="true"><defs><linearGradient id="eg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F6E3B0"/><stop offset=".5" stop-color="#C9A25A"/><stop offset="1" stop-color="#F1DDA8"/></linearGradient></defs><rect x="2" y="2" width="52" height="36" rx="4" fill="url(#eg)"/><path d="M3 4l25 19L53 4" fill="none" stroke="#8A6A35" stroke-width="2"/><path d="M3 37l18-15M53 37L35 22" fill="none" stroke="#8A6A35" stroke-width="1.4" opacity=".6"/><circle cx="28" cy="23" r="4" fill="#9C2F2F"/></svg>';
const HTML=`<div class="st"><div class="sc s-idle on"><div class="tplbox"></div><canvas class="sparks" width="1600" height="900"></canvas></div>
<div class="sc s-free"></div><div class="sc s-vip"></div>
<div class="ticker"><div class="tk"></div></div><div class="progress"></div><canvas class="confetti" width="1600" height="900"></canvas></div>`;
/* Блики (вариант A2): как золотая пыль, но разных размеров и на несколько тонов светлее фона шаблона */
function glints(cv,bg){
  const x=cv.getContext('2d'),m=(bg[0]==='#'?bg.slice(1).match(/../g).map(h=>parseInt(h,16)):(bg.match(/\d+(\.\d+)?/g)||[240,235,225])).map(Number),dark=(m[0]*.3+m[1]*.59+m[2]*.11)<110,K=W/928,P=[];
  const L=t=>m.slice(0,3).map(v=>Math.round(v+(255-v)*t)).join(',');
  const nw=any=>{const r=(Math.random()<.2?8+Math.random()*10:1.5+Math.random()*5)*K;
    return{x:Math.random()*W,y:any?Math.random()*H:H+20,r,v:(.12+Math.random()*.3)*K*(r>10*K?.6:1),ph:Math.random()*6.28,life:0,max:600+Math.random()*700,l:dark?.25+Math.random()*.25:.55+Math.random()*.45};};
  for(let i=0;i<30;i++)P.push(nw(true));
  let id=0;
  const f=()=>{if(!cv.isConnected||cv._stop)return;x.clearRect(0,0,W,H);x.globalCompositeOperation=dark?'lighter':'source-over';
    for(const p of P){p.life++;p.y-=p.v;p.x+=Math.sin(p.life/90+p.ph)*.25*K;
      const k=Math.min(1,p.life/90,(p.max-p.life)/140);if(k<=0||p.y<-p.r*3){Object.assign(p,nw(false));continue;}
      const c=L(p.l),a=(dark?.5:.85)*k,R=p.r*2.2,g=x.createRadialGradient(p.x,p.y,0,p.x,p.y,R);
      g.addColorStop(0,`rgba(${c},${a})`);g.addColorStop(.4,`rgba(${c},${a*.6})`);g.addColorStop(1,`rgba(${c},0)`);
      x.fillStyle=g;x.beginPath();x.arc(p.x,p.y,R,0,6.28);x.fill();}
    id=requestAnimationFrame(f);};
  f();return()=>{cv._stop=true;cancelAnimationFrame(id);x.clearRect(0,0,W,H);};
}

window.TOIScene=function(el,opts){
  opts=opts||{};
  el.classList.add('led');el.innerHTML=HTML;
  const q=s=>el.querySelector(s),st=q('.st');
  let c=null,raw=null,cur=null,token=0,stopG=null;
  function fit(){const w=el.clientWidth;if(w)st.style.transform=`scale(${w/W})`;}
  function setCfg(cfg){
    raw=cfg;c=T.full(cfg);T.vars(el,cfg);
    const box=q('.tplbox');box.innerHTML=`<div style="transform:scale(${W/928});transform-origin:0 0">${T.tplHTML(cfg)}</div>`;
    box.classList.toggle('fx-sheen',c.fx_sheen!==false&&!T.reduce);
    if(stopG)stopG();stopG=null;const sp=q('.sparks');sp._stop=false;
    if(c.fx_sparkle!==false&&!T.reduce){const tl=box.querySelector('.tl');let bg=tl?getComputedStyle(tl).backgroundColor:'';if(!bg||/,\s*0\)$/.test(bg)||bg==='transparent')bg=T.palOf(cfg).bg;stopG=glints(sp,bg);}
    if(cur)show(cur.it,0,true);
  }
  function only(name){['s-idle','s-free','s-vip'].forEach(n=>q('.'+n).classList.toggle('on',n===name));}
  function idle(){cur=null;only('s-idle');q('.ticker').classList.remove('on');bar(0);}
  const wishSize=(s,base)=>{const n=[...String(s||'')].length;return n<=40?base:n<=80?base*.8:n<=120?base*.66:base*.56;};
  async function show(it,sec,again){
    cur={it};const my=++token;
    const orient=it.photo?await T.orientOf(it.photo):'v';
    if(my!==token)return;
    const mode=(c&&c.card)||'auto',o=mode==='landscape'?'h':mode==='portrait'?'v':orient,film=(c&&c.film)||'warm';
    const p=T.palOf(raw||{}),[a,b]=T.splitNames(c?c.names:'');const names=T.esc(T.up(b?a+' & '+b:a));
    if(it.amount){
      const wish=it.msg?`<div class="wish" style="${T.capStyle(it,wishSize(it.msg,50))}">${T.esc(it.msg)}</div>`:'';
      q('.s-vip').innerHTML=`<div class="vrow ${o}">${T.frameHTML(it,o,o==='h'?760:450,film)}
        <div class="vtx"><div class="lbl">PREMIUM</div><div class="who">${T.esc(it.name||'')}</div>${wish}${it.amount>990?`<div class="amt">${ENV}${T.esc(T.fmt(it.amount))}</div>`:''}</div></div>`;
      only('s-vip');q('.ticker').classList.add('on');
      if(it.amount>=10000&&!again)confetti();
    }else{
      const ph=o==='h'?'width:700px;height:480px':'width:520px;height:600px';
      const wish=it.msg?`<div class="wish" style="${T.capStyle(it,wishSize(it.msg,74))}">${T.esc(it.msg)}</div>`:'';
      q('.s-free').innerHTML=`<div class="frow ${o}"><div class="pol" style="padding:28px 28px 0;transform:rotate(-3deg)">${T.photoHTML(it,'',ph+';font-size:22px',film,T.stampOf(raw||{}))}
        <div class="pcap" style="${T.capStyle(it,52)}">${T.esc(it.name||'')}</div></div>
        <div class="ftx">${wish}<div class="rule"></div><div class="names">${names}</div></div></div>`;
      q('.s-free').style.background=p.dark?p.bg:`color-mix(in srgb,${p.bg} 82%,${p.muted})`;
      only('s-free');q('.ticker').classList.remove('on');
    }
    if(sec)bar(sec,!!it.amount);
  }
  function bar(sec,vip){const p=q('.progress');p.style.transition='none';p.style.width='0';if(!sec)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{p.className='progress'+(vip?' vip':'');p.style.transition=`width ${sec}s linear`;p.style.width='100%';}));}
  function ticker(t){q('.tk').textContent=t||'';}
  /* салют сдержанный, в цветах мероприятия */
  function confetti(){
    if(T.reduce||!c)return;const cv=q('.confetti'),x=cv.getContext('2d'),acc=T.palOf(raw||{}).accent;
    const cols=['#E6CD95','#F1DDA8','#B08D4E',acc,'#FFFFFF'];
    const ps=[...Array(140)].map(()=>({x:W*(.2+Math.random()*.6),y:H*.62,vx:(Math.random()-.5)*14,vy:-Math.random()*15-6,c:cols[Math.random()*cols.length|0],s:3+Math.random()*5,a:Math.random()*6}));
    let t=0;(function f(){x.clearRect(0,0,W,H);ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.3;p.a+=.15;x.globalAlpha=Math.max(0,1-t/170);x.fillStyle=p.c;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillRect(-p.s/2,-p.s,p.s,p.s*2);x.restore();});if(++t<170)requestAnimationFrame(f);else x.clearRect(0,0,W,H);})();
  }
  new ResizeObserver(fit).observe(el);fit();
  document.addEventListener('fullscreenchange',()=>setTimeout(fit,80));
  return {setCfg,idle,show,ticker,confetti,get cfg(){return c;}};
};
})();
