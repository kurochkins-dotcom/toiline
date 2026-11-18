/* Toi Line: офлайн для LED-экрана. Если интернет в тойхане пропал, страница экрана, шрифты и фото уже
   загруженных открыток берутся из кэша, и экран продолжает крутить то, что успел получить. */
const C='toi-v1';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));

const isLed=u=>{try{return /^\/s\//.test(new URL(u).pathname);}catch(e){return false;}};
const fromLed=r=>isLed(r.referrer||'')||isLed(r.url);
async function cacheFirst(req){
  const c=await caches.open(C),hit=await c.match(req);if(hit)return hit;
  const res=await fetch(req);if(res.ok||res.type==='opaque')c.put(req,res.clone());return res;
}
async function networkFirst(req){
  const c=await caches.open(C);
  try{const res=await fetch(req);if(res.ok)c.put(req,res.clone());return res;}
  catch(e){const hit=await c.match(req,{ignoreSearch:true});if(hit)return hit;throw e;}
}
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(u.origin===location.origin){
    if(u.pathname.startsWith('/api/'))return;                 // данные и поток — только из сети
    if(u.pathname.startsWith('/p/')){if(fromLed(r))e.respondWith(cacheFirst(r));return;}  // фото открыток
    if(u.pathname.startsWith('/static/')||/^\/s\//.test(u.pathname))e.respondWith(networkFirst(r));
    return;
  }
  if(u.hostname==='fonts.googleapis.com'||u.hostname==='fonts.gstatic.com')e.respondWith(cacheFirst(r));
});
