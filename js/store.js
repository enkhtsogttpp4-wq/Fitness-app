/* ═══════════════════════════════════════════════════════════════
   ХҮЧ — өгөгдлийн давхарга
   • Локал кэш (localStorage) нь ҮРГЭЛЖ эх сурвалж → офлайн ажиллана
   • Supabase руу арын дэвсгэрт синк хийнэ (upsert, updated_at-аар шийднэ)
   • Зураг: IndexedDB-д хадгалаад онлайн болоход Storage руу илгээнэ
   ═══════════════════════════════════════════════════════════════ */

const CFG = window.HUCH_CONFIG || {};
const HAS_CLOUD = !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY);

/* ───────── IndexedDB (зурагт зориулав) ───────── */
const IDB = (()=>{
  let dbp = null;
  const open = ()=> dbp || (dbp = new Promise((res,rej)=>{
    const r = indexedDB.open('huch-media', 1);
    r.onupgradeneeded = ()=> r.result.createObjectStore('blobs');
    r.onsuccess = ()=> res(r.result);
    r.onerror   = ()=> rej(r.error);
  }));
  const tx = async (mode, fn)=>{
    const db = await open();
    return new Promise((res,rej)=>{
      const t = db.transaction('blobs', mode);
      const s = t.objectStore('blobs');
      const q = fn(s);
      t.oncomplete = ()=> res(q && q.result);
      t.onerror    = ()=> rej(t.error);
    });
  };
  return {
    get:  k     => tx('readonly',  s=> s.get(k)),
    set:  (k,v) => tx('readwrite', s=> s.put(v,k)),
    del:  k     => tx('readwrite', s=> s.delete(k)),
    keys: ()    => tx('readonly',  s=> s.getAllKeys()),
  };
})();

/* ───────── Store ───────── */
const Store = {
  sb: null,
  user: null,
  cloud: HAS_CLOUD,
  online: navigator.onLine,
  syncing: false,
  lastSync: null,
  lastError: null,
  data: emptyData(),
  _subs: [],

  on(fn){ this._subs.push(fn); return ()=>{ this._subs = this._subs.filter(f=>f!==fn); }; },
  emit(){ this._subs.forEach(f=>{ try{ f(); }catch(e){ console.error(e); } }); },

  /* ---- эхлүүлэх ---- */
  async init(){
    window.addEventListener('online',  ()=>{ this.online=true;  this.emit(); this.sync(); });
    window.addEventListener('offline', ()=>{ this.online=false; this.emit(); });

    if(HAS_CLOUD){
      try{
        // 1) Төсөл дотор суусан сан  2) боломжгүй бол CDN-ээс
        let createClient = window.supabase && window.supabase.createClient;
        if(!createClient){
          ({ createClient } = await import('https://esm.sh/@supabase/supabase-js@2'));
        }
        this.sb = createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
          auth:{ autoRefreshToken:true, persistSession:true, detectSessionInUrl:false }
        });
        const { data:{ session } } = await this.sb.auth.getSession();
        if(session) this.user = { id:session.user.id, email:session.user.email };
        this.sb.auth.onAuthStateChange((_ev, s)=>{
          const nu = s ? { id:s.user.id, email:s.user.email } : null;
          const changed = (nu?.id || null) !== (this.user?.id || null);
          this.user = nu;
          if(changed){ this.load(); this.emit(); if(nu) this.sync(); }
        });
      }catch(e){
        console.warn('Supabase ачаалж чадсангүй — оффлайн горимд шилжлээ.', e);
        this.cloud = false; this.lastError = 'Supabase холбогдож чадсангүй';
      }
    }
    this.load();
    if(this.user) this.sync();
    setInterval(()=>{ if(this.user && this.online) this.sync(); }, 120000);
    return this;
  },

  key(){ return 'huch.v2.' + (this.user ? this.user.id : 'local'); },

  load(){
    try{
      const raw = localStorage.getItem(this.key());
      this.data = raw ? { ...emptyData(), ...JSON.parse(raw) } : emptyData();
    }catch(e){ this.data = emptyData(); }
  },
  save(){
    try{ localStorage.setItem(this.key(), JSON.stringify(this.data)); }
    catch(e){ console.warn('Локал хадгалалт дүүрсэн байна', e); }
    this.emit();
  },

  /* ---- нэвтрэлт ---- */
  async signUp(email, password){
    if(!this.sb) throw new Error('Supabase тохируулаагүй байна.');
    const { data, error } = await this.sb.auth.signUp({ email, password });
    if(error) throw error;
    // Имэйл баталгаажуулалт унтраасан бол шууд session ирнэ
    if(data.session) await this.adoptLocal();
    return data;
  },
  async signIn(email, password){
    if(!this.sb) throw new Error('Supabase тохируулаагүй байна.');
    const { data, error } = await this.sb.auth.signInWithPassword({ email, password });
    if(error) throw error;
    await this.adoptLocal();
    return data;
  },
  async resetPassword(email){
    if(!this.sb) throw new Error('Supabase тохируулаагүй байна.');
    const { error } = await this.sb.auth.resetPasswordForEmail(email, { redirectTo: location.href });
    if(error) throw error;
  },
  async signOut(){
    if(this.sb) await this.sb.auth.signOut();
    this.user = null; this.load(); this.emit();
  },

  /* Нэвтрэхээс өмнө оффлайн бичсэн өгөгдлийг шинэ дансанд шилжүүлэх */
  async adoptLocal(){
    try{
      const guest = JSON.parse(localStorage.getItem('huch.v2.local') || 'null');
      if(!guest) return;
      const has = (guest.measurements?.length || guest.sets?.length ||
                   guest.foods?.length || guest.profile?.height);
      if(!has) return;
      const { data:{ session } } = await this.sb.auth.getSession();
      if(!session) return;
      const uidNow = session.user.id;
      this.user = { id:uidNow, email:session.user.email };
      this.load();
      const mine = this.data;
      if(!mine.profile?.height && guest.profile) mine.profile = { ...guest.profile, _dirty:true };
      ['measurements','sets','foods','photos'].forEach(c=>{
        const ids = new Set((mine[c]||[]).map(r=>r.id));
        (guest[c]||[]).forEach(r=>{ if(!ids.has(r.id)) mine[c].push({ ...r, _dirty:true }); });
      });
      this.save();
      localStorage.removeItem('huch.v2.local');
    }catch(e){ console.warn('Оффлайн өгөгдөл шилжүүлэхэд алдаа', e); }
  },

  /* ---- бичих ---- */
  setProfile(patch){
    this.data.profile = { ...this.data.profile, ...patch,
      updated_at: new Date().toISOString(), _dirty:true };
    this.save(); this.queueSync();
  },
  put(coll, rec){
    const arr = this.data[coll];
    const now = new Date().toISOString();
    const i = arr.findIndex(r=>r.id===rec.id);
    const row = { ...rec, updated_at:now, deleted:false, _dirty:true };
    if(i>=0) arr[i] = { ...arr[i], ...row }; else arr.push(row);
    this.save(); this.queueSync();
    return row;
  },
  remove(coll, id){
    const arr = this.data[coll];
    const i = arr.findIndex(r=>r.id===id);
    if(i<0) return;
    arr[i] = { ...arr[i], deleted:true, updated_at:new Date().toISOString(), _dirty:true };
    this.save(); this.queueSync();
  },
  list(coll, filterFn){
    return this.data[coll].filter(r=>!r.deleted && (!filterFn || filterFn(r)));
  },

  queueSync(){
    clearTimeout(this._t);
    this._t = setTimeout(()=> this.sync(), 1500);
  },

  /* ---- синк ---- */
  async sync(){
    if(!this.sb || !this.user || !this.online || this.syncing) return;
    this.syncing = true; this.lastError = null; this.emit();
    try{
      await this.pushPhotos();
      await this.push();
      await this.pull();
      this.lastSync = new Date();
    }catch(e){
      console.warn('Синк алдаа', e);
      this.lastError = e.message || 'Синк амжилтгүй';
    }finally{
      this.syncing = false; this.save();
    }
  },

  async push(){
    const uidv = this.user.id;
    // профайл
    if(this.data.profile?._dirty){
      const p = { ...this.data.profile }; delete p._dirty;
      const { error } = await this.sb.from('profiles')
        .upsert({ ...p, id:uidv, email:this.user.email }, { onConflict:'id' });
      if(error) throw error;
      this.data.profile._dirty = false;
    }
    for(const [coll, table] of Object.entries(TABLES)){
      const dirty = this.data[coll].filter(r=>r._dirty);
      if(!dirty.length) continue;
      const rows = dirty.map(r=>{ const o={...r, user_id:uidv}; delete o._dirty; delete o._thumb; return o; });
      const { error } = await this.sb.from(table).upsert(rows, { onConflict:'id' });
      if(error) throw error;
      dirty.forEach(r=> r._dirty = false);
    }
  },

  async pull(){
    const uidv = this.user.id;
    const { data:prof } = await this.sb.from('profiles').select('*').eq('id', uidv).maybeSingle();
    if(prof){
      const local = this.data.profile || {};
      if(!local.updated_at || (prof.updated_at && prof.updated_at > local.updated_at))
        this.data.profile = { ...prof, _dirty:false };
    }
    for(const [coll, table] of Object.entries(TABLES)){
      const { data, error } = await this.sb.from(table).select('*').eq('user_id', uidv);
      if(error) throw error;
      const byId = new Map(this.data[coll].map(r=>[r.id, r]));
      (data||[]).forEach(sv=>{
        const lo = byId.get(sv.id);
        if(!lo || (!lo._dirty && (!lo.updated_at || sv.updated_at >= lo.updated_at))){
          byId.set(sv.id, { ...(lo?._thumb?{_thumb:lo._thumb}:{}) , ...sv, _dirty:false });
        }
      });
      this.data[coll] = [...byId.values()];
    }
  },

  /* ---- зураг ---- */
  async addPhoto(file, dateISO, note){
    const id = uid();
    const thumb = await shrink(file, 480, 0.65);
    const full  = await shrink(file, 1400, 0.82);
    await IDB.set('pending:'+id, full);
    await IDB.set('thumb:'+id, thumb);
    this.put('photos', { id, d:dateISO, note:note||'', path:null });
    this.emit();
    this.sync();
    return id;
  },
  async photoThumb(id){ return await IDB.get('thumb:'+id); },
  async photoURL(rec){
    if(!rec.path || !this.sb) return null;
    const { data, error } = await this.sb.storage.from('progress').createSignedUrl(rec.path, 3600);
    return error ? null : data.signedUrl;
  },
  async pushPhotos(){
    const pend = this.data.photos.filter(p=>!p.deleted && !p.path);
    for(const p of pend){
      const blob = await IDB.get('pending:'+p.id);
      if(!blob) continue;
      const path = `${this.user.id}/${p.id}.jpg`;
      const { error } = await this.sb.storage.from('progress')
        .upload(path, blob, { contentType:'image/jpeg', upsert:true });
      if(error) throw error;
      p.path = path; p._dirty = true;
      await IDB.del('pending:'+p.id);
    }
  },

  /* ---- нөөцлөх / сэргээх ---- */
  exportJSON(){
    return JSON.stringify({ v:2, exported:new Date().toISOString(), data:this.data }, null, 2);
  },
  importJSON(text){
    const o = JSON.parse(text);
    const d = o.data || o;
    this.data = { ...emptyData(), ...d };
    ['measurements','sets','foods','photos'].forEach(c=> this.data[c].forEach(r=> r._dirty=true));
    if(this.data.profile) this.data.profile._dirty = true;
    this.save(); this.sync();
  },
};

const TABLES = { measurements:'measurements', sets:'workout_sets', foods:'food_entries', photos:'photos' };
function emptyData(){ return { profile:{}, measurements:[], sets:[], foods:[], photos:[] }; }

/* Зургийг багасгаж JPEG болгох */
function shrink(file, maxPx, q){
  return new Promise((res,rej)=>{
    const img = new Image();
    img.onload = ()=>{
      const sc = Math.min(1, maxPx/Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width*sc); cv.height = Math.round(img.height*sc);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      cv.toBlob(b=> b ? res(b) : rej(new Error('Зураг боловсруулж чадсангүй')), 'image/jpeg', q);
      URL.revokeObjectURL(img.src);
    };
    img.onerror = ()=> rej(new Error('Зураг уншиж чадсангүй'));
    img.src = URL.createObjectURL(file);
  });
}
