/* Сцена LED-экрана: заставка, открытка, конверт, салют. Используют экран и превью в пульте. */
(function(){
const T=window.TOI;
const HTML=`<div class="layer l-glow"></div><div class="layer l-splash"></div>
<div class="layer l-pat"><canvas></canvas></div>
<div class="layer l-rose"><canvas width="900" height="900"></canvas></div>
<div class="layer l-dust"><canvas></canvas></div><div class="layer l-band"><canvas></canvas></div><div class="layer l-sweep"></div>
<div class="banner"><div class="inner"><div class="kind"></div><div class="names gold"></div><div class="sub"></div><div class="date"></div></div></div>
<div class="head"><span class="gold"></span></div>
<div class="greet"><div class="polaroid"><div class="pic"></div><div class="cap"><div class="who"></div><div class="meta"></div></div></div><div class="txt"><span class="ribbon"><i class="env-ico"></i> КОНВЕРТ · VIP</span><div class="amount gold"></div><div class="msg"></div></div></div>
<div class="ticker"></div><div class="progress"></div><canvas class="confetti"></canvas>`;

window.TOIScene=function(el,opts){
  opts=opts||{};
  el.classList.add('led');el.innerHTML=HTML;
  const q=s=>el.querySelector(s);
  let c=null,dustP=[],raf=0;
  function scene(){if(!c)return;T.renderPattern(q('.l-pat canvas'),c);T.renderBand(q('.l-band canvas'),c);T.renderRose(q('.l-rose canvas'),c);initDust();}
  function initDust(){const cv=q('.l-dust canvas'),r=cv.getBoundingClientRect(),d=devicePixelRatio||1;cv.width=r.width*d;cv.height=r.height*d;
    dustP=[...Array(opts.lite?30:70)].map(()=>({x:Math.random(),y:Math.random(),r:.5+Math.random()*1.8,v:.0004+Math.random()*.0012,p:Math.random()*6.28}));}
  function dust(){
    const cv=q('.l-dust canvas'),x=cv.getContext('2d'),W=cv.width,H=cv.height,d=devicePixelRatio||1;
    x.clearRect(0,0,W,H);if(c){x.fillStyle=T.mix(c.acc,'#ffffff',.3);
    for(const p of dustP){p.y-=p.v;p.p+=.03;if(p.y<-.02){p.y=1.02;p.x=Math.random();}
      x.globalAlpha=.25+.6*Math.abs(Math.sin(p.p));x.beginPath();x.arc(p.x*W+Math.sin(p.p*.5)*6*d,p.y*H,p.r*d,0,Math.PI*2);x.fill();}}
    if(!T.reduce)raf=requestAnimationFrame(dust);
  }
  function setCfg(cfg){
    c=T.full(cfg);T.theme(el,c);
    q('.banner .kind').textContent=c.kind||'';q('.banner .names').textContent=c.names||'';q('.banner .sub').textContent=c.sub||'';q('.banner .date').textContent=c.date||'';
    q('.head .gold').textContent=c.names||'';
    const sp=q('.l-splash');sp.style.backgroundImage=c.splash_url?`url(${c.splash_url})`:'';sp.classList.toggle('on',!!c.splash_url);
    scene();
  }
  function idle(){q('.banner').classList.remove('off');q('.greet').classList.remove('on');q('.head').classList.remove('on');bar(0);}
  function show(it,sec){
    q('.banner').classList.add('off');q('.head').classList.add('on');
    const g=q('.greet');g.className='greet';void g.offsetWidth;g.className='greet on '+(it.amount?'vip':'f-'+(it.frame||'orn'));
    q('.greet .pic').style.backgroundImage=`url("${T.photoOf(it)}")`;
    q('.greet .msg').textContent='«'+it.msg+'»';
    q('.greet .who').textContent=it.name||'';
    q('.greet .meta').textContent=it.table?'стол №'+it.table:'';
    q('.greet .amount').textContent=it.amount?T.fmt(it.amount):'';
    if(it.amount>=10000)confetti();
    if(sec)bar(sec,!!it.amount);
  }
  function bar(sec,vip){const p=q('.progress');p.style.transition='none';p.style.width='0';if(!sec)return;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{p.className='progress'+(vip?' vip':'');p.style.transition=`width ${sec}s linear`;p.style.width='100%';}));}
  function ticker(t){q('.ticker').textContent=t||'';}
  function confetti(){
    if(T.reduce||!c)return;const cv=q('.confetti'),r=cv.getBoundingClientRect();cv.width=r.width;cv.height=r.height;const x=cv.getContext('2d'),acc=c.acc,k=r.width/900;
    const ps=[...Array(200)].map(()=>({x:r.width*(.15+Math.random()*.7),y:r.height*.6,vx:(Math.random()-.5)*10*k,vy:(-Math.random()*11-4)*k,c:[acc,'#fff3d6','#ffffff',acc][Math.random()*4|0],s:(2+Math.random()*4)*k,a:Math.random()*6}));
    let t=0;(function f(){x.clearRect(0,0,cv.width,cv.height);ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.22*k;p.a+=.2;x.fillStyle=p.c;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillRect(-p.s/2,-p.s,p.s,p.s*2);x.restore();});if(++t<180)requestAnimationFrame(f);else x.clearRect(0,0,cv.width,cv.height);})();
  }
  let rt;new ResizeObserver(()=>{clearTimeout(rt);rt=setTimeout(scene,120);}).observe(el);
  document.addEventListener('fullscreenchange',()=>setTimeout(scene,80));
  dust();
  return {setCfg,idle,show,ticker,confetti,get cfg(){return c;}};
};
})();
