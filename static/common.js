/* Toi Line: общее для гостя, экрана, кабинета и альбома.
   Оформление по эскизам 18.11: шаблоны-приглашения, 5 палитр и 5 шрифтов имён на весь сервис (ТЗ 0.10),
   рукописные подписи по кругу (ТЗ 0.7), полароид с плёнкой и рамки Premium (ТЗ 0.3–0.5). */
(function(){
const $=id=>document.getElementById(id);
const fmt=n=>Math.round(n||0).toLocaleString('ru-RU').replace(/[   ,]/g,' ')+' ₸';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const FONTS_URL='https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Playfair+Display:ital@0;1&family=Noto+Serif+Display:wght@200;300&family=Prata&family=Pinyon+Script&family=Petit+Formal+Script&family=Montserrat:wght@300;400;500;600&display=swap';

/* ---------- палитры и шрифты имён (эскиз «Минимал», ТЗ 0.10) ---------- */
const PAL={
  ivory:   {name:'Слоновая кость',bg:'#F7F3EC',ink:'#2A2622',muted:'#6E665C',accent:'#8A6A35'},
  powder:  {name:'Пудра',bg:'#F3E3DE',ink:'#4A2F2C',muted:'#7A5A55',accent:'#A2665A'},
  sage:    {name:'Шалфей',bg:'#E5EADF',ink:'#2F3A2E',muted:'#56614F',accent:'#6F7F5E'},
  bordeaux:{name:'Бордо',bg:'#EFE6D6',ink:'#5A1A24',muted:'#74454B',accent:'#7A1F2B'},
  night:   {name:'Тёмный вечер',bg:'#1F1C1A',ink:'#F3EBDD',muted:'#C9BBA4',accent:'#C9A766',dark:true},
};
/* У латинского Pinyon нет кириллицы: браузер сам берёт недостающие буквы из Toi Great Vibes */
const NFONT={
  corm:  {name:'Cormorant',fam:"'Cormorant Garamond',serif",w:400,it:'normal',caps:true,ls:'.14em',k:1},
  play:  {name:'Playfair курсив',fam:"'Playfair Display',serif",w:400,it:'italic',caps:false,ls:'.01em',k:1.05},
  noto:  {name:'Noto тонкий',fam:"'Noto Serif Display',serif",w:200,it:'normal',caps:true,ls:'.1em',k:1},
  prata: {name:'Prata',fam:"'Prata',serif",w:400,it:'normal',caps:true,ls:'.1em',k:.88},
  vibes: {name:'Great Vibes',fam:"'Toi Great Vibes',cursive",w:400,it:'normal',caps:false,ls:'0',k:1.3},
  spencer:{name:'Spencerian (латиница)',fam:"'Petit Formal Script','Toi Great Vibes',cursive",w:400,it:'normal',caps:false,ls:'0',k:1.05,latin:true},
  pinyon:{name:'Copperplate (латиница)',fam:"'Pinyon Script','Toi Great Vibes',cursive",w:400,it:'normal',caps:false,ls:'0',k:1.4,latin:true},
};
const SCRIPT="'Pinyon Script','Toi Great Vibes',cursive";
/* Подписи под фото: 4 рукописных шрифта по кругу, у каждого свой коэффициент размера (ТЗ 0.7) */
const CAPF=[
  {fam:"'Toi Great Vibes',cursive",it:'normal',k:1.2},
  {fam:"'Toi Comforter',cursive",it:'normal',k:1.35},
  {fam:"'Toi Comforter Brush',cursive",it:'normal',k:1.3},
  {fam:"'Cormorant Garamond',serif",it:'italic',k:1.05},
];
const capFont=card=>CAPF[Math.abs(+(card&&card.id)||0)%CAPF.length];
const capStyle=(card,size)=>{const f=capFont(card);return `font-family:${f.fam};font-style:${f.it};font-size:${Math.round(size*f.k)}px`;};

/* ---------- шаблоны главного экрана (эскиз «Кабинет», экран 2) ---------- */
const TPLS=[
  {id:'mag',  name:'Магнолия',own:false},
  {id:'arch', name:'Арка в розах',own:false},
  {id:'iris', name:'Ирисы',own:false},
  {id:'frame',name:'Бордовая рамка',own:false},
  {id:'clean',name:'Чистый центр',own:true},
  {id:'typo', name:'Типографика',own:true},
  {id:'oval', name:'Рельефный овал',own:true},
  {id:'kraft',name:'Розы на крафте',own:false},
  {id:'photo',name:'С фото пары',own:true},
];
const TPL_BY=Object.fromEntries(TPLS.map(t=>[t.id,t]));
/* Цвета у шаблонов с гравюрами свои — для экрана гостя и альбома берём близкую палитру */
const TPL_PAL={mag:'ivory',arch:'ivory',iris:'ivory',frame:'bordeaux',kraft:'ivory'};

const PRESETS={
  wedding:{title:'Свадьба',kind:'Үйлену тойы',names:'Әділхан & Гүлбаршын',sub:'Шаңырақтарың биік болсын!',
    quick:['Құтты болсын!','Бақытты болыңдар!','Шаңырақтарың биік болсын!','Махаббат пен бақыт тілеймін!'],
    hello:'Тілегіңізді жазып, суретіңізді үлкен экранға шығарыңыз',who:'молодые'},
  jubilee:{title:'Юбилей',kind:'Мерейтой',names:'Серік ата · 60',sub:'Мерейтойыңыз құтты болсын!',
    quick:['Мерейтойыңыз құтты болсын!','Зор денсаулық тілеймін!','Ұзақ ғұмыр, бақуат өмір!'],
    hello:'Тілегіңізді жазып, суретіңізді үлкен экранға шығарыңыз',who:'юбиляр'},
  uzatu:{title:'Қыз ұзату',kind:'Қыз ұзату',names:'Аружан',sub:'Ақ жол, қарындасым!',
    quick:['Ақ жол!','Бақытты бол, қарағым!','Жолың ашық болсын!'],
    hello:'Тілегіңізді жазып, суретіңізді үлкен экранға шығарыңыз',who:'невеста'},
  tusau:{title:'Тұсаукесер',kind:'Тұсаукесер',names:'Алихан · 1 жас',sub:'Қадамың құтты болсын!',
    quick:['Қадамың құтты болсын!','Өсіп-өн, балапан!','Денсаулық тілейміз!'],
    hello:'Тілегіңізді жазып, суретіңізді үлкен экранға шығарыңыз',who:'родители'},
};
function full(cfg){
  const p=PRESETS[cfg.type]||PRESETS.wedding,c={...p,tpl:'mag',palette:'ivory',nfont:'corm',film:'warm',fx_sheen:true,fx_sparkle:true};
  for(const k in cfg)if(cfg[k]!==undefined&&cfg[k]!==null&&cfg[k]!=='')c[k]=cfg[k];
  if(!TPL_BY[c.tpl])c.tpl='mag';if(!PAL[c.palette])c.palette='ivory';if(!NFONT[c.nfont])c.nfont='corm';
  if(!Array.isArray(c.quick)||!c.quick.length)c.quick=p.quick;
  return c;
}
function preset(type){const p=PRESETS[type]||PRESETS.wedding;return {type,kind:p.kind,names:p.names,sub:p.sub,quick:p.quick.slice(),hello:p.hello};}
/* Палитра для страниц вокруг экрана: у «своих» шаблонов — выбранная, у гравюр — родная шаблону */
function palOf(c){c=full(c);return PAL[TPL_BY[c.tpl].own?c.palette:(TPL_PAL[c.tpl]||c.palette)];}
function vars(el,cfg){
  const p=palOf(cfg),f=NFONT[full(cfg).nfont],s=el.style;
  s.setProperty('--bg',p.bg);s.setProperty('--ink',p.ink);s.setProperty('--muted',p.muted);s.setProperty('--accent',p.accent);
  s.setProperty('--name-font',f.fam);el.classList.toggle('dark',!!p.dark);return p;
}

/* ---------- тексты ---------- */
function splitNames(s){
  s=String(s||'').trim();const m=s.split(/\s*(?:&|\+|\s(?:и|мен|және|and)\s)\s*/i).filter(Boolean);
  return m.length>=2?[m[0],m.slice(1).join(' ')]:[s,''];
}
function niceDate(d){const m=String(d||'').trim().match(/^(\d{1,2})[.\/\- ·]+(\d{1,2})[.\/\- ·]+(\d{2,4})$/);
  return m?`${m[1].padStart(2,'0')} · ${m[2].padStart(2,'0')} · ${m[3].length===2?'20'+m[3]:m[3]}`:String(d||'').trim();}
const up=s=>String(s||'').toLocaleUpperCase('kk');
const initials=s=>{const [a,b]=splitNames(s);return [a,b].filter(Boolean).map(x=>x.trim()[0]||'').join(' & ');};
/* Длинные имена влезают: размер подбираем под самое длинное (ТЗ 0.8, пример «Әділхан & Гүлбаршын») */
function fitSize(base,texts,width,em){const n=Math.max(1,...texts.map(t=>[...String(t||'')].length));return Math.round(Math.min(base,width/(n*em)));}

/* ---------- шаблон: HTML в коробке 928×522 ---------- */
function tplHTML(cfg){
  const c=full(cfg),t=c.tpl,p=PAL[c.palette],f=NFONT[c.nfont];
  let [n1,n2]=splitNames(c.names);const kind=esc(c.kind||''),date=esc(niceDate(c.date));
  const one=!n2;
  const nm=(size,width)=>{const caps=f.caps,a=caps?up(n1):n1,b=caps?up(n2):n2,em=(caps?.72:.5)+parseFloat(f.ls)*(f.ls.endsWith('em')?1:0);
    const fs=fitSize(Math.round(size*f.k),[a,b],width,em);
    const st=`font-family:${f.fam};font-weight:${f.w};font-style:${f.it};letter-spacing:${f.ls};font-size:${fs}px`;
    return {a:`<div class="nm" style="${st}">${esc(a)}</div>`,b:b?`<div class="nm" style="${st}">${esc(b)}</div>`:'',fs};};
  const fixed=(style,size,width,em,caps)=>{const a=caps?up(n1):n1,b=caps?up(n2):n2,fs=fitSize(size,[a,b],width,em);
    return {a:`<div class="nm" style="${style};font-size:${fs}px">${esc(a)}</div>`,b:b?`<div class="nm" style="${style};font-size:${fs}px">${esc(b)}</div>`:'',fs};};
  const amp=(size,col,fam)=>one?'':`<div style="${fam||`font-family:${f.fam};font-style:italic;font-weight:${f.w}`};font-size:${Math.round(size*(fam?1:.8))}px;color:${col};line-height:.9">&amp;</div>`;
  const I=n=>'/static/img/'+n+'.png';
  const own=TPL_BY[t].own,bg=own&&c.splash_url&&t!=='photo'?`<div class="bgimg" style="background-image:url('${esc(c.splash_url)}')"></div>`:'';
  if(t==='mag'){const n=fixed(`font-family:${SCRIPT}`,72,420,.5,false);
    return `<div class="tl" style="background:#FBF9F5;color:#4A4640"><img src="${I('magnolia')}" alt="" style="left:-150px;top:-70px;width:560px;transform:rotate(-4deg);-webkit-mask-image:linear-gradient(to bottom,#000 72%,transparent 98%);mask-image:linear-gradient(to bottom,#000 72%,transparent 98%)">
<div class="c" style="left:440px;top:0;bottom:0;width:440px;gap:10px"><div style="font-style:italic;font-size:22px;letter-spacing:.06em;color:#6E665C">${kind}</div>${n.a}${one?'':'<div style="font-style:italic;font-size:22px;color:#6E665C">және</div>'}${n.b}<div style="font-size:30px;letter-spacing:.2em;color:#8A6A35;margin-top:14px">${date}</div></div></div>`;}
  if(t==='arch'){const n=fixed('letter-spacing:.14em',40,330,.8,true);
    return `<div class="tl" style="background:#EFE9E1;color:#2A2622"><img src="${I('rose-pink')}" alt="" style="left:-40px;top:-60px;width:300px;transform:rotate(-18deg)"><img src="${I('rose-yellow')}" alt="" style="right:-40px;top:-40px;width:300px;transform:rotate(22deg)"><img src="${I('rose-pink')}" alt="" style="right:-20px;bottom:-110px;width:300px;transform:rotate(160deg)"><img src="${I('rose-yellow')}" alt="" style="left:-50px;bottom:-90px;width:300px;transform:rotate(200deg)">
<div class="c" style="left:274px;top:36px;width:380px;height:450px;border-radius:190px 190px 18px 18px;background:#FBF9F5;gap:12px;--accent:#8A6A35"><div style="font:500 15px Cormorant Garamond,serif;letter-spacing:.4em;color:#6E665C">${up(kind)}</div><div style="height:8px"></div>${n.a}${amp(36,'#8A6A35',`font-family:'Cormorant Garamond',serif;font-style:italic`)}${n.b}<div style="font-size:18px;letter-spacing:.32em;margin-top:14px">${date}</div></div></div>`;}
  if(t==='iris'){const n=fixed(`font-family:${SCRIPT};color:#3E4A5C`,80,700,.5,false);
    return `<div class="tl" style="background:#F7F5F0;color:#2A2622"><img src="${I('iris')}" alt="" style="left:-90px;top:-110px;width:280px;transform:rotate(150deg)"><img src="${I('iris')}" alt="" style="right:-80px;bottom:-140px;width:280px;transform:rotate(-12deg)">
<div class="c" style="inset:0;gap:8px"><div style="font-style:italic;font-size:22px;color:#6E665C">${kind}</div>${n.a}${amp(44,'#8A6A35',`font-family:${SCRIPT}`)}${n.b}<div style="width:60px;height:1px;background:#8A6A35;margin:12px 0 6px"></div><div style="font-size:20px;letter-spacing:.32em">${date}</div></div></div>`;}
  if(t==='frame'){const n=fixed('letter-spacing:.1em',64,700,.78,true);
    const k='<path d="M26 26 h50 M26 26 v50 M34 34 h30 a10 10 0 0 1 0 20 a6 6 0 0 1 0-12 M34 34 v30 a10 10 0 0 0 20 0 a6 6 0 0 0 -12 0"/>';
    return `<div class="tl" style="background:#EFE6D6;color:#2A2622;--accent:#7A1F2B"><svg aria-hidden="true" width="928" height="522" viewBox="0 0 928 522" style="position:absolute;inset:0" fill="none" stroke="#7A1F2B" stroke-width="1.6" stroke-linecap="round"><path d="M90 26 H838 M90 496 H838"/>${k}<g transform="translate(928,0) scale(-1,1)">${k}</g><g transform="translate(0,522) scale(1,-1)">${k}</g><g transform="translate(928,522) scale(-1,-1)">${k}</g></svg>
<div class="c" style="inset:0;gap:14px">${n.a}${one?'':'<div style="font:500 17px Cormorant Garamond,serif;letter-spacing:.45em;color:#7A1F2B">ЖӘНЕ</div>'}${n.b}<div style="font-size:22px;letter-spacing:.1em;margin-top:16px">${date}</div><div style="font-family:${SCRIPT};font-size:32px;color:#7A1F2B">${kind}</div></div></div>`;}
  if(t==='kraft'){const fs=Math.min(fitSize(88,[n1],500,.5),fitSize(88,['& '+n2],480,.5)),n={fs,a:`<div class="nm" style="font-family:${SCRIPT};font-size:${fs}px">${esc(n1)}</div>`};
    return `<div class="tl" style="background:#E6D8BE;color:#4A2E22;--accent:#8A6A35"><div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.35),transparent 60%),radial-gradient(ellipse at 80% 90%,rgba(120,90,50,.12),transparent 60%)"></div><img src="${I('rose-pink')}" alt="" style="right:-60px;top:-90px;width:340px;transform:rotate(-20deg)"><img src="${I('rose-yellow')}" alt="" style="left:-90px;bottom:-130px;width:340px;transform:rotate(15deg)">
<div style="position:absolute;left:200px;top:110px;width:540px;display:flex;flex-direction:column;gap:6px"><div style="font-style:italic;font-size:22px">${kind}</div><div style="margin-top:10px">${n.a}</div>${one?'':`<div style="padding-left:60px"><div class="nm" style="font-family:${SCRIPT};font-size:${n.fs}px">&amp; ${esc(n2)}</div></div>`}<div style="align-self:flex-end;margin-top:18px;font-style:italic;font-size:22px">${date}</div></div></div>`;}
  const base=`background:${p.bg};color:${p.ink}`;
  if(t==='clean'){const n=nm(60,820);
    return `<div class="tl" style="${base}">${bg}<div class="c" style="inset:0;gap:12px"><div style="font-style:italic;font-size:24px;color:${p.muted}">${kind}</div>${n.a}${amp(42,p.accent)}${n.b}<div style="width:60px;height:1px;background:${p.accent};margin:12px 0 6px"></div><div style="font-size:20px;letter-spacing:.32em">${date}</div></div></div>`;}
  if(t==='typo'){const n=nm(64,840);
    return `<div class="tl" style="${base}">${bg}<div class="c" style="inset:0;gap:14px">${n.a}${one?'':`<div style="font:500 17px Cormorant Garamond,serif;letter-spacing:.45em;color:${p.accent}">ЖӘНЕ</div>`}${n.b}<div style="font-size:15px;letter-spacing:.3em;color:${p.muted};margin-top:18px">${up(kind)}${kind&&date?' · ':''}${up(date)}</div></div></div>`;}
  if(t==='oval'){const n=nm(30,250);
    return `<div class="tl${p.dark?' dark':''}" style="${base};--bg:${p.bg}">${bg}<div class="emboss" style="position:absolute;left:309px;top:26px;width:310px;height:470px;padding:13px;box-sizing:border-box"><div class="dots c" style="position:relative;gap:10px;padding:0 22px"><div style="font-style:italic;font-size:18px;color:${p.muted}">${kind}</div>${n.a}${amp(30,p.accent)}${n.b}<div style="width:40px;height:1px;background:${p.accent};margin:8px 0"></div><div style="font-size:16px;letter-spacing:.3em">${date}</div></div></div></div>`;}
  /* photo */
  const n=nm(44,400),ph=c.couple_url
    ?`<div style="position:absolute;left:0;top:0;width:470px;height:522px;background:url('${esc(c.couple_url)}') 50% 20%/cover no-repeat;-webkit-mask-image:linear-gradient(to right,#000 70%,transparent);mask-image:linear-gradient(to right,#000 70%,transparent)"></div>`
    :`<div class="emboss" style="position:absolute;left:90px;top:56px;width:300px;height:410px;padding:12px;box-sizing:border-box;--bg:${p.bg}"><div class="dots" style="display:grid;place-items:center;text-align:center;color:${p.muted};font:500 15px/1.5 Cormorant Garamond,serif;padding:0 40px">Фото пары<br>загрузите в кабинете</div></div>`;
  return `<div class="tl${p.dark?' dark':''}" style="${base}">${ph}<div class="c" style="left:470px;top:0;bottom:0;right:30px;gap:10px"><div style="font-style:italic;font-size:22px;color:${p.muted}">${kind}</div>${n.a}${amp(36,p.accent)}${n.b}<div style="width:56px;height:1px;background:${p.accent};margin:10px 0 4px"></div><div style="font-size:18px;letter-spacing:.32em">${date}</div></div></div>`;
}
/* Шаблон в контейнере любой ширины: рисуем 928×522 и масштабируем */
function mountTpl(box,cfg){
  const w=box.clientWidth||928;box.style.position='relative';box.style.overflow='hidden';
  box.innerHTML=`<div style="position:absolute;left:0;top:0;transform-origin:0 0;transform:scale(${w/928})">${tplHTML(cfg)}</div>`;
}

/* ---------- приглашение 4:5 (кабинет организатора, ТЗ 0.8–0.9): коробка 400×500, скачивается 1080×1350 ---------- */
const MONTHS={kz:['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан'],
  ru:['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']};
function dparts(d){const m=String(d||'').match(/(\d{1,2})[.\/\- ·]+(\d{1,2})[.\/\- ·]+(\d{2,4})/);
  return m&&+m[2]>=1&&+m[2]<=12?{d:+m[1],m:+m[2],y:m[3].length===2?'20'+m[3]:m[3]}:null;}
function longDate(d,lang){const x=dparts(d);if(!x)return String(d||'').trim();return lang==='ru'?`${x.d} ${MONTHS.ru[x.m-1]} ${x.y}`:`${x.d} ${MONTHS.kz[x.m-1]}, ${x.y}`;}
function shortDate(d){const x=dparts(d);return x?`${String(x.d).padStart(2,'0')}.${String(x.m).padStart(2,'0')}.${x.y.slice(-2)}`:String(d||'').trim();}
const INV_TXT={
  kz:w=>({inv:w?'үйлену тойына шақырамыз':'тойымызға шақырамыз',intro:'Құрметті ағайын-туыс,<br>сіздерді тойымызға шақырамыз',
    arch:'Сіздерді ақ дастарханымыздың қадірлі қонағы болуға шақырамыз',frame:w?'ҮЙЛЕНУ ТОЙЫНА<br>ШАҚЫРАДЫ':'ТОЙҒА<br>ШАҚЫРАДЫ',
    kraft:'Сіздерді біздің тойымызға<br>шақырамыз',short:'Сіздерді тойымызға шақырамыз',and:'және',AND:'ЖӘНЕ',
    time:t=>'сағат '+t,host:h=>'Құрметпен, '+h,dear:n=>'Құрметті '+n+'!'}),
  ru:w=>({inv:w?'приглашаем на свадьбу':'приглашаем на наш праздник',intro:'Дорогие родные и друзья,<br>приглашаем вас на наш той',
    arch:'Будем рады видеть вас почётными гостями за нашим дастарханом',frame:w?'ПРИГЛАШАЮТ<br>НА СВАДЬБУ':'ПРИГЛАШАЮТ<br>НА ТОЙ',
    kraft:'Приглашаем вас<br>на наш той',short:'Приглашаем вас на наш той',and:'и',AND:'И',
    time:t=>'в '+t,host:h=>'С уважением, '+h,dear:n=>'Дорогие '+n+'!'}),
};
/* Стиль приглашения: по умолчанию как у экрана, организатор может поменять отдельно */
function invCfg(cfg){const c=full(cfg),iv=c.inv||{};
  return {...c,tpl:TPL_BY[iv.tpl]?iv.tpl:c.tpl,palette:PAL[iv.palette]?iv.palette:c.palette,nfont:NFONT[iv.nfont]?iv.nfont:c.nfont,
    lang:iv.lang==='ru'?'ru':'kz',text:iv.text||''};}
/* opts.guest — именное приглашение: «Құрметті …!» вместо общего обращения */
function inviteHTML(cfg,opts){
  const c=invCfg(cfg),t=c.tpl,p=PAL[c.palette],f=NFONT[c.nfont],L=INV_TXT[c.lang](c.type==='wedding'),guest=String((opts&&opts.guest)||'').trim();
  let [n1,n2]=splitNames(c.names);const one=!n2;
  const time=String(c.time||'').trim(),place=String(c.place||'').trim(),addr=String(c.address||'').trim(),host=String(c.host||'').trim();
  const nd=esc(niceDate(c.date)),dt=nd+(time?' · '+esc(time):''),tl=time?esc(L.time(time)):'';
  const hostL=(sz,col,mt)=>host?`<div style="font-style:italic;font-size:${sz}px;color:${col};margin-top:${mt}px">${esc(L.host(host))}</div>`:'';
  /* верхняя строка: именное обращение, свой текст или текст шаблона; длинное — мельче и в 2 строки */
  const lead=(def,sz,col,w,extra)=>{let h,n;
    if(guest){const d=L.dear(guest);n=[...d].length;h=`<span style="font-style:normal;font-weight:500">${esc(d)}</span><br>${c.text?esc(c.text):L.short}`;}
    else if(c.text){h=esc(c.text);n=[...c.text].length;}
    else{if(!def)return '';h=def;n=0;}
    const fs=Math.round(n>70?sz*.8:n>44?sz*.9:sz);
    return `<div style="font-style:italic;font-size:${fs}px;line-height:1.35;color:${col};max-width:${w}px;${extra||''}">${h}</div>`;};
  const scriptN=(size,width,col)=>{const fs=fitSize(size,[n1,n2],width,.5),st=`font-family:${SCRIPT};font-size:${fs}px;line-height:1.08;color:${col}`;
    return {a:`<div class="nm" style="${st}">${esc(n1)}</div>`,b:one?'':`<div class="nm" style="${st}">${esc(n2)}</div>`,fs};};
  const capsN=(size,width,ls,col)=>{const a=up(n1),b=up(n2),fs=fitSize(size,[a,b],width,.72+ls),st=`font-weight:400;letter-spacing:${ls}em;font-size:${fs}px;line-height:1.12;${col?'color:'+col:''}`;
    return {a:`<div class="nm" style="${st}">${esc(a)}</div>`,b:one?'':`<div class="nm" style="${st}">${esc(b)}</div>`};};
  const ownN=(size,width)=>{const caps=f.caps,a=caps?up(n1):n1,b=caps?up(n2):n2,em=(caps?.72:.5)+(f.ls.endsWith('em')?parseFloat(f.ls):0);
    const fs=fitSize(Math.round(size*f.k),[a,b],width,em),st=`font-family:${f.fam};font-weight:${f.w};font-style:${f.it};letter-spacing:${f.ls};font-size:${fs}px;line-height:1.1`;
    return {a:`<div class="nm" style="${st}">${esc(a)}</div>`,b:b?`<div class="nm" style="${st}">${esc(b)}</div>`:''};};
  const amp=(size,col,fam)=>one?'':`<div style="${fam||`font-family:${f.fam};font-style:italic;font-weight:${f.w}`};font-size:${Math.round(size*(fam?1:.8))}px;color:${col};line-height:.9">&amp;</div>`;
  const I=n=>'/static/img/'+n+'.png';
  if(t==='mag'){const n=scriptN(38,180,'#4A4640');
    return `<div class="inv" style="background:#FBF9F5;color:#4A4640"><img src="${I('magnolia')}" alt="" style="left:-175px;top:-24px;width:370px;transform:rotate(-4deg)"><div style="position:absolute;left:0;top:186px;width:215px;height:96px;background:linear-gradient(to bottom,rgba(251,249,245,0),#FBF9F5 88%)"></div>
<div style="position:absolute;left:206px;top:0;bottom:0;width:184px;display:flex;flex-direction:column;justify-content:center;gap:9px">${lead(L.intro,15,'#6E665C',184,'letter-spacing:.03em')}<div style="margin-top:6px">${n.a}</div>${one?'':`<div style="font-style:italic;font-size:16px;color:#6E665C">${L.and}</div>`}${n.b}
<div style="font-size:32px;letter-spacing:.12em;color:#8A6A35;margin-top:12px">${esc(shortDate(c.date))}</div>${tl?`<div style="font-size:16px;color:#6E665C">${tl}</div>`:''}${place||addr?`<div style="font-style:italic;font-size:15px;color:#6E665C;line-height:1.35;margin-top:6px">${esc(place)}${place&&addr?'<br>':''}${esc(addr)}</div>`:''}${hostL(14,'#6E665C',6)}</div></div>`;}
  if(t==='arch'){const n=capsN(27,236,.14);
    return `<div class="inv" style="background:#EFE9E1;color:#2A2622"><img src="${I('rose-pink')}" alt="" style="left:-40px;top:-30px;width:190px;transform:rotate(-18deg)"><img src="${I('rose-yellow')}" alt="" style="right:-50px;top:-10px;width:200px;transform:rotate(22deg)"><img src="${I('rose-pink')}" alt="" style="right:-30px;bottom:-60px;width:190px;transform:rotate(160deg)"><img src="${I('rose-yellow')}" alt="" style="left:-60px;bottom:-40px;width:200px;transform:rotate(200deg)">
<div class="c" style="left:62px;top:56px;width:276px;height:388px;border-radius:138px 138px 18px 18px;background:#FBF9F5;gap:8px;padding:0 18px;box-sizing:border-box;box-shadow:0 0 0 1px rgba(42,38,34,.06)"><div style="font:500 13px Cormorant Garamond,serif;letter-spacing:.34em;color:#6E665C">${esc(up(c.kind))}</div><div style="margin-top:4px">${n.a}</div>${amp(26,'#8A6A35',`font-family:'Cormorant Garamond',serif;font-style:italic`)}${n.b}
${lead(L.arch,14,'#5C564E',220,'margin-top:4px')}<div style="font-size:14px;letter-spacing:.3em;margin-top:4px">${nd}</div><div style="font-size:14px;color:#5C564E">${[esc(time),esc(place)].filter(Boolean).join(' · ')}</div></div></div>`;}
  if(t==='iris'){const n=scriptN(46,320,'#3E4A5C');
    return `<div class="inv" style="background:#F7F5F0;color:#2A2622"><img src="${I('iris')}" alt="" style="left:-85px;top:-85px;width:180px;transform:rotate(150deg)"><img src="${I('iris')}" alt="" style="right:-80px;bottom:-105px;width:180px;transform:rotate(-12deg)">
<div class="c" style="inset:0;gap:7px;padding:0 50px">${lead(L.inv,16,'#6E665C',300)}<div style="margin-top:4px">${n.a}</div>${amp(28,'#8A6A35',`font-family:${SCRIPT}`)}${n.b}<div style="width:44px;height:1px;background:#8A6A35;margin:10px 0 6px"></div>
<div style="font-size:15px;letter-spacing:.28em">${dt}</div>${place?`<div style="font-size:14px;letter-spacing:.12em;color:#5C564E">${esc(up(place))}</div>`:''}${hostL(15,'#6E665C',8)}</div></div>`;}
  if(t==='frame'){const n=capsN(42,320,.1);
    const k='<path d="M26 26 h50 M26 26 v50 M34 34 h30 a10 10 0 0 1 0 20 a6 6 0 0 1 0-12 M34 34 v30 a10 10 0 0 0 20 0 a6 6 0 0 0 -12 0"/>';
    return `<div class="inv" style="background:#EFE6D6;color:#2A2622"><svg aria-hidden="true" width="400" height="500" viewBox="0 0 400 500" style="position:absolute;inset:0" fill="none" stroke="#7A1F2B" stroke-width="1.4" stroke-linecap="round"><path d="M26 80 V420 M374 80 V420"/>${k}<g transform="translate(400 0) scale(-1 1)">${k}</g><g transform="translate(0 500) scale(1 -1)">${k}</g><g transform="translate(400 500) scale(-1 -1)">${k}</g></svg>
<div class="c" style="inset:0;gap:9px;padding:0 44px">${lead('',14,'#5C564E',300,'margin-bottom:8px')}${n.a}${one?'':`<div style="font:500 15px Cormorant Garamond,serif;letter-spacing:.4em;color:#7A1F2B">${L.AND}</div>`}${n.b}
<div style="font-size:13px;letter-spacing:.24em;color:#5C564E;margin-top:12px;line-height:1.7">${L.frame}</div><div style="font-size:19px;letter-spacing:.08em;margin-top:10px">${esc(longDate(c.date,c.lang))}</div>${tl?`<div style="font-size:17px;letter-spacing:.08em">${tl}</div>`:''}
${place||addr?`<div style="font-size:15px;color:#5C564E;line-height:1.4;margin-top:4px">${esc(place)}${place&&addr?'<br>':''}${esc(addr)}</div>`:''}${host?`<div style="font-family:${SCRIPT};font-size:22px;color:#7A1F2B;margin-top:6px">${esc(host)}</div>`:''}</div></div>`;}
  if(t==='kraft'){const fs=Math.min(fitSize(52,[n1],320,.5),fitSize(52,['& '+n2],290,.5)),st=`font-family:${SCRIPT};font-size:${fs}px;line-height:1.05`;
    return `<div class="inv" style="background:#E6D8BE;color:#4A2E22"><div style="position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,rgba(255,255,255,.35),transparent 60%),radial-gradient(ellipse at 80% 90%,rgba(120,90,50,.12),transparent 60%)"></div><img src="${I('rose-pink')}" alt="" style="right:-110px;top:-70px;width:240px;transform:rotate(-20deg)"><img src="${I('rose-yellow')}" alt="" style="left:-80px;bottom:-90px;width:250px;transform:rotate(15deg)">
<div style="position:absolute;left:40px;top:0;bottom:30px;width:320px;display:flex;flex-direction:column;justify-content:center;gap:6px">${lead(L.kraft,16,'#4A2E22',260)}<div class="nm" style="${st};margin-top:12px">${esc(n1)}</div>${one?'':`<div class="nm" style="${st};padding-left:30px">&amp; ${esc(n2)}</div>`}
<div style="align-self:flex-end;margin-top:18px;font-style:italic;font-size:16px;line-height:1.45;text-align:right;max-width:220px">${esc(longDate(c.date,c.lang))}${time?' · '+esc(time):''}${place?'<br>'+esc(place):''}${addr?'<br>'+esc(addr):''}</div>${host?`<div style="align-self:flex-end;font-style:italic;font-size:14px;margin-top:4px">${esc(L.host(host))}</div>`:''}</div></div>`;}
  const base=`background:${p.bg};color:${p.ink}`,dk=p.dark?' dark':'';
  if(t==='clean'){const n=ownN(34,320);
    return `<div class="inv${dk}" style="${base}"><div class="c" style="inset:0;gap:9px;padding:0 40px">${lead(L.inv,17,p.muted,320)}${n.a}${amp(30,p.accent)}${n.b}<div style="width:44px;height:1px;background:${p.accent};margin:10px 0 6px"></div>
<div style="font-size:15px;letter-spacing:.28em">${dt}</div>${place?`<div style="font-size:14px;letter-spacing:.12em;color:${p.muted}">${esc(up(place))}</div>`:''}${hostL(15,p.muted,10)}</div></div>`;}
  if(t==='typo'){const n=ownN(40,330);
    return `<div class="inv${dk}" style="${base}"><div class="c" style="inset:0;gap:9px;padding:0 36px">${lead('',14,p.muted,320,'margin-bottom:8px')}${n.a}${one?'':`<div style="font:500 15px Cormorant Garamond,serif;letter-spacing:.4em;color:${p.accent}">${L.AND}</div>`}${n.b}
<div style="font-size:13px;letter-spacing:.24em;color:${p.muted};margin-top:14px;line-height:1.7">${L.frame}</div><div style="font-size:19px;letter-spacing:.08em;margin-top:10px">${esc(longDate(c.date,c.lang))}</div>${tl?`<div style="font-size:17px;letter-spacing:.08em">${tl}</div>`:''}
${place||addr?`<div style="font-size:15px;color:${p.muted};line-height:1.4;margin-top:4px">${esc(place)}${place&&addr?'<br>':''}${esc(addr)}</div>`:''}${hostL(15,p.muted,6)}</div></div>`;}
  if(t==='oval'){const n=ownN(24,180);
    return `<div class="inv${dk}" style="${base}"><div style="position:absolute;left:70px;top:34px;width:260px;height:432px;padding:12px;box-sizing:border-box;border-radius:50%;background:${p.bg};box-shadow:${p.dark?'0 3px 8px rgba(0,0,0,.55),0 -1px 2px rgba(255,255,255,.06)':'0 3px 8px rgba(120,100,70,.2),0 -2px 3px rgba(255,255,255,.9)'}"><div class="dots c" style="position:relative;width:100%;height:100%;border-radius:50%;border:2.5px dotted ${p.dark?'rgba(201,167,102,.45)':'rgba(120,100,70,.3)'};gap:7px;padding:0 24px">
<div style="font-style:italic;font-size:15px;color:${p.muted}">${esc(c.kind)}</div>${guest||c.text?lead('',13,p.muted,190):''}${n.a}${amp(24,p.accent)}${n.b}<div style="width:34px;height:1px;background:${p.accent};margin:6px 0"></div>
<div style="font-size:14px;letter-spacing:.28em">${nd}</div><div style="font-size:14px;color:${p.muted}">${[esc(time),esc(place)].filter(Boolean).join(' · ')}</div>${host?`<div style="font-style:italic;font-size:14px;color:${p.muted};margin-top:4px">${esc(host)}</div>`:''}</div></div></div>`;}
  /* photo */
  const n=ownN(24,300),ph=c.couple_url?`background:url('${esc(c.couple_url)}') 50% 22%/cover no-repeat`:`background:${p.accent};opacity:.25`;
  return `<div class="inv${dk}" style="${base}"><div class="c" style="inset:0;justify-content:flex-start;padding:26px 40px 0">
<div style="width:250px;height:${guest||c.text?260:285}px;flex:none;border-radius:130px 130px 6px 6px;${ph};box-shadow:0 0 0 1px ${p.accent},0 0 0 7px ${p.bg},0 0 0 8px ${p.accent}"></div>
${lead(L.inv,15,p.muted,320,'margin-top:16px')}<div style="margin-top:4px">${n.a}</div>${amp(22,p.accent)}${n.b}<div style="font-size:14px;letter-spacing:.28em;margin-top:6px">${dt}</div>${place?`<div style="font-size:13px;letter-spacing:.12em;color:${p.muted};margin-top:2px">${esc(up(place))}</div>`:''}</div></div>`;
}
function mountInv(box,cfg,opts){
  const w=box.clientWidth||400;box.style.position='relative';box.style.overflow='hidden';
  box.innerHTML=`<div style="position:absolute;left:0;top:0;transform-origin:0 0;transform:scale(${w/400})">${inviteHTML(cfg,opts)}</div>`;
}

/* ---------- фото: полароид, рамки Premium ---------- */
const FR={ // проём в процентах: слева, сверху, справа, снизу
  altyn:{name:'Алтын',h:[620,438,15.4,18.1,14.8,18.5],v:[438,620,18.1,14.8,18.5,15.4]},
  kara: {name:'Қара-алтын',h:[620,417,15,16.9,12.5,16.9],v:[417,620,16.9,12.5,16.9,15]},
  kumis:{name:'Күміс',h:[620,506,7.4,9.3,7.4,8.4],v:[506,620,8.4,7.4,9.3,7.4]},
};
const frameKey=f=>FR[f]?f:'altyn';
function stampOf(cfg){const m=String(full(cfg).date||'').match(/(\d{1,2})[.\/\- ·]+(\d{1,2})[.\/\- ·]+(\d{2,4})/);
  const d=m?[m[1],m[2],m[3].slice(-2)]:(()=>{const x=new Date();return [x.getDate(),x.getMonth()+1,String(x.getFullYear()).slice(-2)];})();
  return `${String(d[0]).padStart(2,'0')} ${String(d[1]).padStart(2,'0')} ’${d[2]}`;}
/* фото с плёнкой; без фото — инициал гостя на бумаге */
function photoHTML(card,cls,style,film,stamp){
  const ini=esc((String(card.name||'').trim()[0]||'♡').toLocaleUpperCase('kk'));
  return `<div class="ph${film&&film!=='none'?' film-'+film:''} ${cls||''}" style="${style||''};${card.photo?`background-image:url('${esc(card.photo)}')`:''}">${card.photo?'':`<span class="ini">${ini}</span>`}${stamp&&card.photo&&film!=='none'?`<span class="stamp">${esc(stamp)}</span>`:''}</div>`;
}
/* рамка по ориентации фото; width — ширина рамки в px */
function frameHTML(card,orient,width,film){
  const g=FR[frameKey(card.frame)][orient==='h'?'h':'v'],k=width/g[0],h=Math.round(g[1]*k);
  return `<div class="frm" style="width:${Math.round(width)}px;height:${h}px">${photoHTML(card,'',`left:${g[2]}%;top:${g[3]}%;right:${g[4]}%;bottom:${g[5]}%`,film)}<img src="/static/img/frame-${frameKey(card.frame)}-${orient==='h'?'h':'v'}.png" alt=""></div>`;
}
const orientCache={};
function orientOf(url){
  if(!url)return Promise.resolve('v');if(orientCache[url])return Promise.resolve(orientCache[url]);
  return new Promise(ok=>{const i=new Image();i.onload=()=>ok(orientCache[url]=i.naturalWidth>i.naturalHeight*1.06?'h':'v');i.onerror=()=>ok('v');i.src=url;});
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
/* Для пульта: маленькая картинка вместо фото */
const avCache={};
function avatar(name){
  name=name||'Гость';if(avCache[name])return avCache[name];
  const c=document.createElement('canvas');c.width=c.height=240;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,240,240);g.addColorStop(0,'#efe8dc');g.addColorStop(1,'#ded4c3');x.fillStyle=g;x.fillRect(0,0,240,240);
  x.fillStyle='#8a7f70';x.font='300 120px "Cormorant Garamond", serif';x.textAlign='center';x.textBaseline='middle';x.fillText((name.trim()[0]||'?').toLocaleUpperCase('kk'),120,128);
  return avCache[name]=c.toDataURL('image/jpeg',.85);
}
const photoOf=card=>card.photo||avatar(card.name);

/* ---------- правила показа ---------- */
/* Бесплатное поздравление 10 сек, Premium 1 минута (ТЗ 0.4) */
const durOf=v=>v?60:10;

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
  if(!r.ok){const e=new Error(j.error||('Ошибка '+r.status));e.retry=j.retry||0;throw e;}
  return j;
}
const abs=p=>location.origin+p;
const tm=t=>new Date(t).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Almaty'});

window.TOI={$,fmt,esc,reduce,FONTS_URL,PAL,NFONT,SCRIPT,CAPF,capFont,capStyle,TPLS,TPL_BY,PRESETS,FR,full,preset,palOf,vars,
  splitNames,niceDate,up,initials,fitSize,tplHTML,mountTpl,inviteHTML,mountInv,invCfg,longDate,stampOf,photoHTML,frameHTML,frameKey,orientOf,
  readImg,avatar,photoOf,durOf,drawQR,api,abs,tm};
})();
