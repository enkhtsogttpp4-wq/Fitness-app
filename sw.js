/* ═══════════════════════════════════════════════════════════════
   Фитнесс зөвлөгөө, тэмдэглэл — Service Worker
   Аппыг офлайн ажиллуулна. Кодоо шинэчилсэн бол доорх
   CACHE хувилбарын дугаарыг нэмэгдүүлээрэй (v3, v4 …) —
   тэгэхгүй бол хэрэглэгчид хуучин хувилбарыг үзсээр байна.
   ═══════════════════════════════════════════════════════════════ */
const CACHE = 'huch-v6';
const SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/vendor/supabase.js',
  './js/config.js',
  './js/data.js',
  './js/core.js',
  './js/store.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=> Promise.allSettled(SHELL.map(u=> c.add(u))))
      .then(()=> self.skipWaiting())
  );
});

self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys()
      .then(ks=> Promise.all(ks.filter(k=>k!==CACHE).map(k=> caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase API / Storage — хэзээ ч кэшлэхгүй
  if(url.hostname.endsWith('.supabase.co')) return;

  // Навигаци: эхлээд сүлжээ, амжилтгүй бол кэш
  if(req.mode === 'navigate'){
    e.respondWith(
      fetch(req).then(r=>{
        const cp = r.clone();
        caches.open(CACHE).then(c=> c.put('./index.html', cp));
        return r;
      }).catch(()=> caches.match('./index.html'))
    );
    return;
  }

  // Бусад: кэш эхлээд, зэрэгцээд шинэчилнэ
  e.respondWith(
    caches.match(req).then(hit=>{
      const net = fetch(req).then(r=>{
        if(r && r.status===200 && (url.origin===location.origin || url.hostname==='esm.sh')){
          const cp = r.clone();
          caches.open(CACHE).then(c=> c.put(req, cp));
        }
        return r;
      }).catch(()=> hit);
      return hit || net;
    })
  );
});
