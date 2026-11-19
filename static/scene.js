/* Сцена LED-экрана по эскизам 6–8б: заставка-шаблон, бесплатное (полароид с плёнкой), Premium (рамка).
   Рисуем на холсте 1600×900 и масштабируем под экран. Используют экран и превью в кабинете. */
(function(){
const T=window.TOI,W=1600,H=900;
const HTML=`<div class="st"><div class="sc s-idle on"><div class="tplbox"></div><div class="sparks"></div></div>
<div class="sc s-free"></div><div class="sc s-vip"></div>
<div class="ticker"><div class="tk"></div></div><div class="progress"></div><canvas class="confetti" width="1600" height="900"></canvas></div>`;
const SPARKS=[[300,200],[860,290],[1180,140],[1340,640],[460,700],[1000,760],[160,420],[1460,320]];

window.TOIScene=function(el,opts){
  opts=opts||{};
  el.classList.add('led');el.innerHTML=HTML;
  const q=s=>el.querySelector(s),st=q('.st');
  let c=null,raw=null,cur=null,token=0;
  function fit(){const w=el.clientWidth;if(w)st.style.transform=`scale(${w/W})`;}
  function setCfg(cfg){
    raw=cfg;c=T.full(cfg);T.vars(el,cfg);
    const box=q('.tplbox');box.innerHTML=`<div style="transform:scale(${W/928});transform-origin:0 0">${T.tplHTML(cfg)}</div>`;
    box.classList.toggle('fx-sheen',c.fx_sheen!==false&&!T.reduce);
    const sp=q('.sparks');sp.innerHTML=c.fx_sparkle!==false?SPARKS.map(([x,y],i)=>`<i style="left:${x}px;top:${y}px;animation-delay:${(i*.7)%5}s"></i>`).join(''):'';
    sp.style.setProperty('--spark',T.palOf(cfg).dark?'#E8C977':'#D4A84A');
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
        <div class="vtx"><div class="lbl">КОНВЕРТ</div><div class="who">${T.esc(it.name||'')}</div>${wish}<div class="amt">${T.esc(T.fmt(it.amount))}</div></div></div>`;
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
