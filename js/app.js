/* ═══════════════════════════════════════════════════════════════
   ХҮЧ — интерфэйс
   ═══════════════════════════════════════════════════════════════ */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const nf = (v,d=0)=> Number(v||0).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const MONTHS = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
const WDAYS  = ['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба'];
const SLOTS  = ['Өглөө','Өдөр','Орой','Зууш'];

function toast(msg, ms=2200){
  const el = document.createElement('div');
  el.className='toast'; el.textContent=msg;
  $('#toastHost').innerHTML=''; $('#toastHost').appendChild(el);
  setTimeout(()=> el.remove(), ms);
}
function fmtDate(iso){
  const d = new Date(iso+'T00:00:00');
  return { long:`${MONTHS[d.getMonth()]} ${d.getDate()}`, wd:WDAYS[d.getDay()],
           isToday: iso===todayISO() };
}
function shiftDate(iso, n){
  const d = new Date(iso+'T00:00:00'); d.setDate(d.getDate()+n);
  return d.toLocaleDateString('sv-SE');
}

/* ───────── төлөв ───────── */
let dayFood  = todayISO();
let dayTrain = todayISO();
let planVariant = 0;
let dbCat = 'Бүгд', dbQ = '';

const prof = ()=> Store.data.profile || {};
function profForCalc(){
  const p = prof();
  return { weight:+p.weight, height:+p.height, age:+p.age||27, sex:p.sex||'m',
           bodyFat:p.body_fat?+p.body_fat:null, goal:p.goal||'bulk', exp:p.exp||'adv',
           days:+p.days||4, activity:+p.activity||1.325, meals:+p.meals||4 };
}
const hasProfile = ()=> !!(prof().height && prof().weight);
const targets = ()=> hasProfile() ? calcTargets(profForCalc()) : null;

/* ═══════════ ЭХЛҮҮЛЭХ ═══════════ */
(async function boot(){
  await Store.init();
  Store.on(renderAll);
  bindAuth(); bindTabs(); bindProfile(); bindFood(); bindTrain(); bindProgress(); bindAccount();
  route();
})();

function route(){
  const localMode = localStorage.getItem('huch.mode') === 'local';
  const needAuth = Store.cloud && !Store.user && !localMode;
  $('#screen-auth').hidden = !needAuth;
  $('#screen-app').hidden  = needAuth;
  if(!needAuth){ renderAll(); openFromURL(); }
}
/* manifest-ийн шууд холбоос: ?go=food | train | prog */
function openFromURL(){
  const go = new URLSearchParams(location.search).get('go');
  if(!go) return;
  const map = { food:'p-food', train:'p-train', prog:'p-prog', profile:'p-profile' };
  if(map[go]) goTab(map[go]);
  history.replaceState(null, '', location.pathname);
}

/* ═══════════ НЭВТРЭХ ═══════════ */
let authMode = 'in';
function bindAuth(){
  const msg = (cls,txt)=> $('#authMsg').innerHTML = txt ? `<div class="${cls}">${txt}</div>` : '';
  const setMode = m=>{
    authMode = m;
    $('#aSubmit').textContent   = m==='in' ? 'Нэвтрэх' : 'Бүртгүүлэх';
    $('#aSwitchTxt').textContent= m==='in' ? 'Шинэ хэрэглэгч үү?' : 'Бүртгэлтэй юу?';
    $('#aSwitch').textContent   = m==='in' ? 'Бүртгүүлэх' : 'Нэвтрэх';
    $('#aPass').autocomplete    = m==='in' ? 'current-password' : 'new-password';
    msg('','');
  };
  $('#aSwitch').onclick = ()=> setMode(authMode==='in' ? 'up' : 'in');

  $('#aSubmit').onclick = async ()=>{
    const email = $('#aEmail').value.trim(), pass = $('#aPass').value;
    if(!email || !pass) return msg('err','Имэйл, нууц үгээ бүрэн оруулна уу.');
    if(pass.length < 6)  return msg('err','Нууц үг дор хаяж 6 тэмдэгт байх ёстой.');
    $('#aSubmit').disabled = true; $('#aSubmit').textContent = 'Түр хүлээнэ үү…';
    try{
      if(authMode==='in'){
        await Store.signIn(email, pass);
        localStorage.removeItem('huch.mode');
        route();
      }else{
        if(CFG.ALLOW_SIGNUP === false) throw new Error('Шинэ бүртгэл түр хаалттай байна.');
        const r = await Store.signUp(email, pass);
        if(r.session){ localStorage.removeItem('huch.mode'); route(); }
        else msg('ok','Бүртгэл үүслээ. Имэйл рүү ирсэн холбоосыг дарж баталгаажуулаад нэвтэрнэ үү.');
      }
    }catch(e){
      msg('err', translateAuthError(e.message||''));
    }finally{
      $('#aSubmit').disabled=false;
      $('#aSubmit').textContent = authMode==='in' ? 'Нэвтрэх' : 'Бүртгүүлэх';
    }
  };
  $('#aForgot').onclick = async ()=>{
    const email = $('#aEmail').value.trim();
    if(!email) return msg('err','Эхлээд имэйлээ бичнэ үү.');
    try{ await Store.resetPassword(email); msg('ok','Нууц үг сэргээх холбоос имэйл рүү илгээлээ.'); }
    catch(e){ msg('err', translateAuthError(e.message||'')); }
  };
  $('#aLocal').onclick = ()=>{ localStorage.setItem('huch.mode','local'); route(); toast('Оффлайн горимд ажиллаж байна'); };
  $('#aPass').addEventListener('keydown', e=>{ if(e.key==='Enter') $('#aSubmit').click(); });
  setMode('in');
}
function translateAuthError(m){
  const s = m.toLowerCase();
  if(s.includes('invalid login')) return 'Имэйл эсвэл нууц үг буруу байна.';
  if(s.includes('already registered')||s.includes('already been')) return 'Энэ имэйл аль хэдийн бүртгэлтэй байна. Нэвтэрнэ үү.';
  if(s.includes('email not confirmed')) return 'Имэйлээ баталгаажуулаагүй байна. Ирсэн холбоосыг дарна уу.';
  if(s.includes('password')) return 'Нууц үг шаардлага хангахгүй байна (дор хаяж 6 тэмдэгт).';
  if(s.includes('signups not allowed')||s.includes('signup is disabled')) return 'Шинэ бүртгэл хаалттай байна.';
  if(s.includes('rate limit')) return 'Хэт олон оролдлого. Хэсэг хүлээгээд дахин оролдоно уу.';
  if(s.includes('failed to fetch')||s.includes('network')) return 'Сүлжээнд холбогдож чадсангүй.';
  return m || 'Алдаа гарлаа.';
}

/* ═══════════ ТАБ ═══════════ */
function bindTabs(){
  $('#tabBar').addEventListener('click', e=>{
    const b = e.target.closest('.tab'); if(!b) return; goTab(b.dataset.p);
  });
  $('#btnSync').onclick = ()=>{
    if(!Store.user) return toast('Оффлайн горим — синк хийхгүй');
    Store.sync().then(()=> toast(Store.lastError ? 'Синк амжилтгүй' : 'Синк дууслаа'));
  };
}
function goTab(id){
  $$('.tab').forEach(t=>t.setAttribute('aria-selected', String(t.dataset.p===id)));
  $$('.page').forEach(p=>p.classList.toggle('on', p.id===id));
  window.scrollTo(0,0);
}

/* ═══════════ ПРОФАЙЛ ═══════════ */
function segGet(id){ return $(id).querySelector('[aria-pressed="true"]')?.dataset.v; }
function segSet(id,v){ [...$(id).children].forEach(c=>c.setAttribute('aria-pressed', String(c.dataset.v===v))); }
function bindProfile(){
  ['#segSex','#segGoal','#segExp'].forEach(id=>{
    $(id).addEventListener('click', e=>{
      const b=e.target.closest('button'); if(!b) return;
      [...$(id).children].forEach(c=>c.setAttribute('aria-pressed', String(c===b)));
    });
  });
  $('#btnCalc').onclick = ()=>{
    const h=+$('#fH').value, w=+$('#fW').value;
    if(!h||!w) return toast('Өндөр, жингээ оруулна уу');
    if(h<130||h>230||w<35||w>250) return toast('Өндөр эсвэл жин буруу байна');
    Store.setProfile({
      name:$('#fName').value.trim(), age:+$('#fAge').value||27, sex:segGet('#segSex'),
      height:h, weight:w, body_fat: $('#fBf').value ? +$('#fBf').value : null,
      goal:segGet('#segGoal'), exp:segGet('#segExp'),
      days:+$('#fDays').value, meals:+$('#fMeals').value, activity:+$('#fAct').value,
    });
    // анхны жинг хэмжилт болгож нэмэх
    if(!Store.list('measurements').length)
      Store.put('measurements', { id:uid(), d:todayISO(), weight:w, chest:null, waist:null, hip:null, arm:null, thigh:null, note:'' });
    toast('Хадгаллаа');
    $('#resultZone').hidden = false;
    $('#resultZone').scrollIntoView({behavior:'smooth', block:'start'});
  };
}
function fillProfileForm(){
  const p = prof();
  if($('#fH') === document.activeElement) return;
  $('#fName').value = p.name || '';
  $('#fAge').value  = p.age  || 27;
  $('#fH').value    = p.height || '';
  $('#fW').value    = p.weight || '';
  $('#fBf').value   = p.body_fat || '';
  $('#fDays').value = p.days || 5;
  $('#fMeals').value= p.meals || 4;
  $('#fAct').value  = p.activity || 1.325;
  segSet('#segSex',  p.sex  || 'm');
  segSet('#segGoal', p.goal || 'bulk');
  segSet('#segExp',  p.exp  || 'adv');
}

/* ═══════════ ЗОРИЛТ ═══════════ */
function renderTargets(){
  const t = targets(); const p = prof();
  $('#resultZone').hidden = !t;
  if(!t) return;

  $('#targetTiles').innerHTML = `
    <div class="tile hero"><div class="lab">Өдрийн илчлэг</div><div class="val">${nf(t.kcal)} <span>ккал</span></div>
      <div class="dl">${t.kcal===t.tdee?'Тэнцвэрт түвшин':(t.kcal>t.tdee?'+'+nf(t.kcal-t.tdee)+' илүүдэл':nf(t.kcal-t.tdee)+' дутуу')}</div></div>
    <div class="tile"><div class="lab">TDEE</div><div class="val">${nf(t.tdee)} <span>ккал</span></div><div class="dl">Жин тогтмол барих түвшин</div></div>
    <div class="tile"><div class="lab">BMR</div><div class="val">${nf(t.bmr)} <span>ккал</span></div><div class="dl">Тайван үеийн зарцуулалт</div></div>
    <div class="tile"><div class="lab">BMI</div><div class="val">${t.bmi}</div><div class="dl">${BMI_LABEL(t.bmi)}${t.bmi>=25?' — булчинлаг хүнд BMI зөв хэмжүүр биш':''}</div></div>
    <div class="tile"><div class="lab">Туранхай масс</div><div class="val">${t.lbm?nf(t.lbm,1)+' <span>кг</span>':'—'}</div>
      <div class="dl">${t.lbm?'Өөхөөс бусад бүх масс':'Өөхний % оруулбал тооцно'}</div></div>
    <div class="tile"><div class="lab">7 хоногийн зорилт</div><div class="val">${t.rateTxt}</div>
      <div class="dl">${p.goal==='bulk'?'Илүү хурдан бол өөх түлхүү':p.goal==='cut'?'Илүү хурдан бол булчин алдана':'Хүчээ өсгө'}</div></div>`;

  $('#macroBars').innerHTML = [
    ['Уураг', t.pro, t.pro*4, 'var(--s1)'],
    ['Нүүрс ус', t.carb, t.carb*4, 'var(--s2)'],
    ['Өөх тос', t.fat, t.fat*9, 'var(--s3)'],
  ].map(([k,g,kc,col])=>`
    <div class="macro"><div class="mh">
      <span class="nm"><i class="dot" style="background:${col}"></i>${k}</span>
      <span class="vv">${nf(g)} г · ${nf(kc)} ккал · ${Math.round(kc/t.kcal*100)}%</span></div>
      <div class="bar"><i style="width:${(kc/t.kcal*100).toFixed(1)}%;background:${col}"></i></div></div>`).join('')
    + `<div class="macro" style="margin-top:15px"><div class="mh">
        <span class="nm"><i class="dot" style="background:var(--s4)"></i>Эслэг</span><span class="vv">${t.fiber} г</span></div></div>
       <div class="macro"><div class="mh">
        <span class="nm"><i class="dot" style="background:var(--muted)"></i>Ус</span><span class="vv">${t.water} л / өдөр</span></div></div>`;

  const split = SPLITS[+p.days || 4];
  $('#planNotes').innerHTML = `
    <b style="color:var(--text)">Зорилго:</b> ${({bulk:'булчин нэмэх',cut:'өөх хасах',recomp:'recomp'})[p.goal]||'—'} ·
    <b style="color:var(--text)">${p.days} өдөр/7 хоног</b> · ${split.name}<br><br>
    <b style="color:var(--text)">1.</b> Өдөрт <b style="color:var(--s1)">${nf(t.kcal)} ккал</b>, уураг <b style="color:var(--s1)">${t.pro}г</b>.
    Уургаа эхэлж хангаад үлдсэнийг нүүрс ус, өөхөөр дүүргэ.<br>
    <b style="color:var(--text)">2.</b> Жингээ 7 хоногт 1 удаа, өглөө сэрээд, ижил нөхцөлд хэмж.
    ${p.goal==='bulk' ? `2–3 долоо хоногийн дунджаар <b style="color:var(--text)">+${t.rate}кг/7 хоног</b>-оос хурдан нэмэгдвэл илчлэгээ 150–200 ккал бууруул.`
      : p.goal==='cut' ? `<b style="color:var(--text)">−${t.rate}кг/7 хоног</b>-оос хурдан хасагдвал булчин алдаж эхэлнэ.`
      : 'Жин тогтмол байхад өргөлтийн жин өсөж байвал recomp ажиллаж байна.'}<br>
    <b style="color:var(--text)">3.</b> Унтлага <b style="color:var(--text)">7–9 цаг</b>. Нойргүй байхад хооллолт хэдий сайн ч ахиц зогсоно.<br>
    <b style="color:var(--text)">4.</b> Креатин моногидрат өдөрт 5г — хамгийн батлагдсан, хамгийн хямд нэмэлт.<br>
    <b style="color:var(--text)">5.</b> ${p.exp==='adv'
      ? 'Туршлагатай хүний булчингийн өсөлт жилд <b style="color:var(--text)">1.5–3кг</b> байх нь бодит хүлээлт. Өргөлтийн жингээ өсгөх нь гол хэмжүүр.'
      : 'Эхний жилүүдэд өсөлт хамгийн хурдан — техникээ зөв сурч, тогтмол давтамжаа хадгал.'}`;

  $('#mnTips').innerHTML = `
    <b style="color:var(--text)">Улаан мах — таны давуу тал.</b> Монголд мах хямд, чанартай. Хонь, ямаа, адууны мах бол
    бүрэн уураг + креатин + төмөр + цайр. Гэхдээ өөхийг нь тайрч, гуяны махыг сонго.<br><br>
    <b style="color:var(--text)">Сүүтэй цайны нуугдмал илчлэг.</b> Өрөм, тос хийсэн 1 аяга ≈ 210 ккал.
    Өдөрт 4 аяга уувал 840 ккал. Давслаг цайг тослохгүй ууж, тосоо хоолондоо шилжүүл.<br><br>
    <b style="color:var(--text)">Ааруул, борц, тунецын консерв — хамгийн сайн явган зууш.</b>
    100г ааруул ≈ 33г уураг, борц ≈ 65г уураг, 1 сав тунец ≈ 39г уураг. Ажлын ширээндээ тавь.<br><br>
    <b style="color:var(--text)">Өвлийн ногоо ба эслэг.</b> Байцаа, лууван, манжин, хөлдөөсөн ногооны холимог нь
    хямд, удаан хадгалагддаг. Өдөрт <b style="color:var(--text)">${t.fiber}г эслэг</b> хэрэгтэй.<br><br>
    <b style="color:var(--text)">Бууз, хуушуур — хориглох биш, тоолох.</b> 10 бууз ≈ 1120 ккал, 3 хуушуур ≈ 900 ккал.
    Бүртгэлдээ оруулж л байвал ямар ч хоол таны төлөвлөгөөнд багтана.<br><br>
    <b style="color:var(--text)">D витамин.</b> 10–4 сард Монголд нар багатай. Өдөрт 1000–2000 IU D3 нь
    тестостерон, ясны эрүүл мэндэд ач холбогдолтой. Хэмжээгээ эмчээс тодруул.`;
}

/* ═══════════ ӨНӨӨДӨР ═══════════ */
function renderToday(){
  const t = targets();
  if(!t){
    $('#todayGate').innerHTML = `<div class="card"><div class="empty">
      Эхлээд <b>Профайл</b> хэсэгт өндөр, жингээ оруулна уу.<br><br>
      <button class="btn sm" onclick="goTab('p-profile')">Профайл бөглөх</button></div></div>`;
    $('#todayMain').hidden = true; return;
  }
  $('#todayGate').innerHTML=''; $('#todayMain').hidden=false;

  const p = prof();
  const h = new Date().getHours();
  $('#greet').textContent = (h<11?'Өглөөний мэнд':h<18?'Өдрийн мэнд':'Оройн мэнд') + (p.name?', '+p.name:'');
  const fd = fmtDate(todayISO());
  $('#todayDate').textContent = `${fd.long} · ${fd.wd} гараг`;

  const eaten = dayTotals(todayISO());
  const over  = eaten.k > t.kcal;
  const left  = Math.max(0, t.kcal - eaten.k);
  const pct   = Math.min(1, eaten.k / t.kcal);
  const C = 2*Math.PI*51;
  const ring = $('#kRing');
  ring.setAttribute('stroke-dasharray', `${(pct*C).toFixed(1)} ${C.toFixed(1)}`);
  ring.setAttribute('data-zero', pct<=0 ? '1' : '0');
  ring.style.stroke = eaten.k > t.kcal*1.05 ? 'var(--warn)' : 'var(--s1)';
  $('#kLeft').textContent = over ? nf(eaten.k - t.kcal) : nf(left);
  $('#kLeftLbl').textContent = over ? 'ккал хэтэрсэн' : 'ккал үлдсэн';
  $('#kEaten').innerHTML = `Идсэн <b style="color:var(--text)">${nf(eaten.k)}</b> / ${nf(t.kcal)} ккал`;

  $('#todayMacros').innerHTML = [
    ['Уураг', eaten.p, t.pro, 'var(--s1)'],
    ['Н/ус',  eaten.c, t.carb,'var(--s2)'],
    ['Өөх',   eaten.f, t.fat, 'var(--s3)'],
  ].map(([k,v,tg,col])=>`
    <div class="macro"><div class="mh"><span class="nm"><i class="dot" style="background:${col}"></i>${k}</span>
      <span class="vv">${nf(v)} / ${nf(tg)} г</span></div>
      <div class="bar"><i style="width:${Math.min(100,v/tg*100).toFixed(1)}%;background:${col}"></i></div></div>`).join('');

  // өнөөдрийн дасгал
  const split = SPLITS[+p.days || 4];
  const sets = Store.list('sets', r=>r.d===todayISO());
  if(sets.length){
    const di = sets[0].day_idx || 0;
    const byEx = {};
    sets.forEach(s=> (byEx[s.exercise_key] = byEx[s.exercise_key]||[]).push(s));
    const vol = sets.reduce((a,s)=>a+(s.weight*s.reps||0),0);
    $('#todayWorkout').innerHTML = `
      <div style="font-weight:700;font-size:14px;margin-bottom:4px">${split.days[di]?.nm||'Дасгал'}</div>
      <div class="hint">${sets.length} сет · ${Object.keys(byEx).length} дасгал · нийт эзлэхүүн ${nf(vol)} кг</div>`;
  } else {
    const dow = new Date().getDay();
    const suggest = split.days[(dow+6) % split.days.length];
    $('#todayWorkout').innerHTML = `
      <div style="font-weight:700;font-size:14px;margin-bottom:4px">${suggest.nm}</div>
      <div class="hint">${suggest.mg} · ${suggest.ex.length} дасгал. Өнөөдөр хараахан сет бүртгээгүй байна.</div>`;
  }

  // хураангуй
  const ms = Store.list('measurements').sort((a,b)=>a.d.localeCompare(b.d));
  const last = ms[ms.length-1];
  const wkSets = Store.list('sets', r=> r.d >= shiftDate(todayISO(),-6));
  const wkVol  = wkSets.reduce((a,s)=>a+(s.weight*s.reps||0),0);
  let trend='—';
  if(ms.length>=2){
    const a=ms[0], b=ms[ms.length-1];
    const days=(new Date(b.d)-new Date(a.d))/864e5 || 1;
    const per=(b.weight-a.weight)/days*7;
    trend = (per>0?'+':'')+per.toFixed(2)+' кг/7хон';
  }
  $('#todayTiles').innerHTML = `
    <div class="tile"><div class="lab">Одоогийн жин</div><div class="val">${last?nf(last.weight,1):'—'} <span>кг</span></div>
      <div class="dl">${last?last.d:'Бүртгэл алга'}</div></div>
    <div class="tile"><div class="lab">Жингийн чиг</div><div class="val" style="font-size:20px">${trend}</div>
      <div class="dl">Зорилт ${t.rateTxt}/7 хоног</div></div>
    <div class="tile"><div class="lab">7 хоногийн эзлэхүүн</div><div class="val">${nf(wkVol/1000,1)} <span>тн</span></div>
      <div class="dl">${wkSets.length} сет</div></div>`;
}
function dayTotals(d){
  return Store.list('foods', r=>r.d===d).reduce((a,r)=>({
    k:a.k+(+r.kcal||0), p:a.p+(+r.protein||0), f:a.f+(+r.fat||0), c:a.c+(+r.carb||0)}), {k:0,p:0,f:0,c:0});
}

/* ═══════════ ХООЛ ═══════════ */
function bindFood(){
  $('#foodNav').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    [...$('#foodNav').children].forEach(c=>c.setAttribute('aria-pressed', String(c===b)));
    $('#foodLog').hidden  = b.dataset.v!=='log';
    $('#foodPlan').hidden = b.dataset.v!=='plan';
    $('#foodDB').hidden   = b.dataset.v!=='db';
    renderFood();
  });
  $('#fPrev').onclick = ()=>{ dayFood = shiftDate(dayFood,-1); renderFood(); };
  $('#fNext').onclick = ()=>{ dayFood = shiftDate(dayFood, 1); renderFood(); };
  $('#fAdd').onclick  = ()=> openFoodSheet();
  $('#qAddFood').onclick = ()=>{ goTab('p-food'); openFoodSheet(); };
  $('#qGoTrain').onclick = ()=> goTab('p-train');
  $('#qAddWeight').onclick = ()=>{
    goTab('p-prog');
    [...$('#progNav').children].forEach(c=>c.setAttribute('aria-pressed', String(c.dataset.v==='m')));
    $('#progWeight').hidden=true; $('#progMeas').hidden=false; $('#progPhoto').hidden=true;
    setTimeout(()=>$('#mW').focus(), 200);
  };
  $('#dbSearch').addEventListener('input', e=>{ dbQ=e.target.value.trim().toLowerCase(); renderDB(); });
  $('#dbCats').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b)return; dbCat=b.dataset.c; renderDB(); });
}

function renderFood(){
  const fd = fmtDate(dayFood);
  $('#fDateTxt').textContent = fd.isToday ? 'Өнөөдөр' : fd.long;
  $('#fDateSub').textContent = `${fd.long} · ${fd.wd}`;
  $('#fNext').disabled = dayFood >= todayISO();
  $('#fNext').style.opacity = dayFood >= todayISO() ? .35 : 1;

  const t = targets(), tot = dayTotals(dayFood);
  $('#foodDayTotals').innerHTML = !t ? '' : `
    <div class="card tight">${[
      ['Илчлэг', tot.k, t.kcal, 'ккал','var(--s4)'],
      ['Уураг',  tot.p, t.pro,  'г','var(--s1)'],
      ['Нүүрс ус',tot.c,t.carb, 'г','var(--s2)'],
      ['Өөх тос',tot.f, t.fat,  'г','var(--s3)'],
    ].map(([k,v,tg,u,col])=>`
      <div class="macro"><div class="mh"><span class="nm"><i class="dot" style="background:${col}"></i>${k}</span>
      <span class="vv">${nf(v)} / ${nf(tg)} ${u}</span></div>
      <div class="bar"><i style="width:${Math.min(110,v/tg*100).toFixed(1)}%;background:${col}"></i></div></div>`).join('')}</div>`;

  const rows = Store.list('foods', r=>r.d===dayFood);
  $('#foodSlots').innerHTML = rows.length ? SLOTS.map(slot=>{
    const rs = rows.filter(r=>r.slot===slot);
    if(!rs.length) return '';
    const st = rs.reduce((a,r)=>({k:a.k+ +r.kcal, p:a.p+ +r.protein, f:a.f+ +r.fat, c:a.c+ +r.carb}),{k:0,p:0,f:0,c:0});
    return `<div class="slot">
      <div class="sh"><b>${slot}</b><em>${nf(st.k)} ккал · У ${nf(st.p)} · Н ${nf(st.c)} · Ө ${nf(st.f)}</em></div>
      ${rs.map(r=>`<div class="lrow">
        <div class="lm"><div class="lt">${r.name}</div><div class="ls">${fmtAmount(r)}</div></div>
        <div class="lv">${nf(r.kcal)} ккал<br><span style="font-size:11px;color:var(--muted)">У${nf(r.protein)} Н${nf(r.carb)} Ө${nf(r.fat)}</span></div>
        <button class="x" data-del="${r.id}">✕</button></div>`).join('')}
    </div>`;
  }).join('') : `<div class="card"><div class="empty">Энэ өдөр хоол бүртгээгүй байна.<br>Доорх товчоор нэмнэ үү.</div></div>`;

  $('#foodSlots').querySelectorAll('[data-del]').forEach(b=>
    b.onclick = ()=>{ Store.remove('foods', b.dataset.del); toast('Устгалаа'); });

  renderPlan(); renderDB();
}
const fmtAmount = r => /^100/.test(r.unit||'') ? `${nf(r.amount)} ${(r.unit||'').includes('мл')?'мл':'г'}`
  : `${r.amount} ${(r.unit||'').replace(/^1\s*/,'').replace(/\(.*\)/,'').trim() || 'ш'}`;

/* ---- хоол нэмэх хуудас ---- */
function openFoodSheet(preset){
  let q='', cat='Бүгд', chosen=preset||null;
  const host = $('#sheetHost');
  const close = ()=> host.innerHTML='';

  const draw = ()=>{
    if(chosen){
      const it = chosen;
      const per100 = /^100/.test(it.u);
      const unitTxt = per100 ? ((it.u.includes('мл')?'мл':'грамм')) : (it.u.replace(/^1\s*/,'').replace(/\(.*\)/,'').trim()||'ширхэг');
      const def = per100 ? 100 : 1;
      host.innerHTML = `<div class="sheet-bg"><div class="sheet">
        <div class="sheet-h"><button class="icon-btn" id="shBack">‹ Буцах</button><b>${it.n}</b></div>
        <div class="sheet-b">
          <div class="hint" style="margin-bottom:14px">1 ${per100?'100г':(it.u)} тутамд: <b style="color:var(--text)">${it.k} ккал</b> ·
            У ${it.p}г · Ө ${it.f}г · Н ${it.c}г${it.nb?`<br><span style="color:var(--s4)">${it.nb}</span>`:''}</div>
          <div class="field"><label for="shAmt">Хэмжээ (${unitTxt})</label>
            <input type="number" id="shAmt" step="${per100?5:0.5}" inputmode="decimal" value="${def}"></div>
          <div class="field"><label>Хэзээ идсэн</label>
            <div class="seg" id="shSlot">${SLOTS.map((s,i)=>`<button data-v="${s}" aria-pressed="${i===defaultSlot()?'true':'false'}">${s}</button>`).join('')}</div></div>
          <div class="card tight" id="shPrev" style="margin-bottom:14px"></div>
          <button class="btn" id="shAdd">Бүртгэлд нэмэх</button>
        </div></div></div>`;
      const upd = ()=>{
        const a = +$('#shAmt').value || 0;
        const u = per100 ? a/100 : a;
        $('#shPrev').innerHTML = `<div class="between"><b style="font-size:16px">${nf(it.k*u)} ккал</b>
          <span class="hint">У ${nf(it.p*u,1)}г · Н ${nf(it.c*u,1)}г · Ө ${nf(it.f*u,1)}г</span></div>`;
      };
      $('#shAmt').addEventListener('input', upd); upd();
      $('#shSlot').addEventListener('click', e=>{ const b=e.target.closest('button'); if(!b)return;
        [...$('#shSlot').children].forEach(c=>c.setAttribute('aria-pressed', String(c===b))); });
      $('#shBack').onclick = ()=>{ chosen=null; draw(); };
      $('#shAdd').onclick = ()=>{
        const a = +$('#shAmt').value || 0;
        if(a<=0) return toast('Хэмжээгээ оруулна уу');
        const u = per100 ? a/100 : a;
        Store.put('foods', { id:uid(), d:dayFood, slot:segGet('#shSlot')||'Өглөө',
          name:it.n, unit:it.u, amount:a,
          kcal:+(it.k*u).toFixed(1), protein:+(it.p*u).toFixed(1),
          fat:+(it.f*u).toFixed(1), carb:+(it.c*u).toFixed(1) });
        close(); toast(it.n+' нэмэгдлээ');
      };
      $('#shAmt').select?.();
      return;
    }
    const cats = ['Бүгд', ...new Set(FOODS.map(f=>f.cat))];
    const list = FOODS.filter(f=>(cat==='Бүгд'||f.cat===cat) &&
      (!q || f.n.toLowerCase().includes(q) || f.cat.toLowerCase().includes(q))).slice(0,120);
    host.innerHTML = `<div class="sheet-bg"><div class="sheet">
      <div class="sheet-h"><b>Хоол сонгох</b><button class="icon-btn" id="shClose">Хаах</button></div>
      <div class="sheet-b">
        <div class="searchbar"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
          <input type="text" id="shQ" placeholder="Хайх…" value="${q}"></div>
        <div class="cats">${cats.map(c=>`<button data-c="${c}" aria-pressed="${c===cat}">${c}</button>`).join('')}</div>
        ${list.length ? list.map(f=>`<button class="fitem" data-n="${encodeURIComponent(f.n)}">
            <div class="fm"><div class="fn">${f.n}</div><div class="fu">${f.u}${f.nb?' · '+f.nb:''}</div></div>
            <div class="fk">${f.k} ккал</div></button>`).join('')
          : `<div class="empty">Илэрц олдсонгүй</div>`}
      </div></div></div>`;
    $('#shClose').onclick = close;
    host.querySelector('.sheet-bg').addEventListener('click', e=>{ if(e.target.classList.contains('sheet-bg')) close(); });
    const qi = $('#shQ');
    qi.addEventListener('input', e=>{ q=e.target.value.trim().toLowerCase(); const pos=e.target.selectionStart; draw(); const n=$('#shQ'); n.focus(); n.setSelectionRange(pos,pos); });
    host.querySelectorAll('.cats button').forEach(b=> b.onclick=()=>{ cat=b.dataset.c; draw(); });
    host.querySelectorAll('.fitem').forEach(b=> b.onclick=()=>{ chosen=FOODS.find(f=>f.n===decodeURIComponent(b.dataset.n)); draw(); });
  };
  draw();
}
function defaultSlot(){ const h=new Date().getHours(); return h<11?0 : h<16?1 : h<21?2 : 3; }

/* ---- санал болгох цэс ---- */
function renderPlan(){
  const t = targets();
  if(!t){ $('#foodPlan').innerHTML = `<div class="card"><div class="empty">Эхлээд профайлаа бөглөнө үү.</div></div>`; return; }
  const meals = buildPlan(t, +prof().meals||4, planVariant);
  const T = meals.reduce((a,m)=>({k:a.k+m.tot.k,p:a.p+m.tot.p,f:a.f+m.tot.f,c:a.c+m.tot.c}),{k:0,p:0,f:0,c:0});

  $('#foodPlan').innerHTML = `
    <div class="card tight"><div class="between">
      <div><h3 class="ct">Өдрийн санал цэс</h3><div class="hint">Хувилбар ${planVariant+1} · ${prof().meals||4} удаагийн хооллолт</div></div>
      <button class="btn sm ghost" id="pRegen">↻ Өөр</button></div></div>
    ${meals.map((m,mi)=>`<div class="slot">
      <div class="sh"><b>${m.nm}</b><em>${nf(m.tot.k)} ккал · У ${nf(m.tot.p)} · Н ${nf(m.tot.c)} · Ө ${nf(m.tot.f)}</em></div>
      ${m.rows.map(r=>`<div class="lrow"><div class="lm"><div class="lt">${r.name}</div></div>
        <div class="lv">${r.amt} · ${nf(r.k)} ккал</div></div>`).join('')}
      <button class="btn ghost sm" style="width:100%;margin-top:10px" data-eat="${mi}">Энэ хоолыг бүртгэлд нэмэх</button>
    </div>`).join('')}
    <div class="card">
      <h3 class="ct">Цэс vs зорилт</h3>
      <div class="hint" style="margin:4px 0 14px">±5% зөрүү бол хэвийн.</div>
      ${[['Илчлэг',T.k,t.kcal,'ккал','var(--s4)'],['Уураг',T.p,t.pro,'г','var(--s1)'],
         ['Нүүрс ус',T.c,t.carb,'г','var(--s2)'],['Өөх тос',T.f,t.fat,'г','var(--s3)']]
        .map(([k,v,tg,u,col])=>{ const d=Math.round(v-tg), ok=Math.abs(v/tg*100-100)<=7; return `
        <div class="macro"><div class="mh"><span class="nm"><i class="dot" style="background:${col}"></i>${k}</span>
        <span class="vv">${nf(v)} / ${nf(tg)} ${u} <span class="pill ${ok?'g':'w'}" style="margin-left:5px">${d>0?'+':''}${d}</span></span></div>
        <div class="bar"><i style="width:${Math.min(115,v/tg*100).toFixed(1)}%;background:${col}"></i></div></div>`;}).join('')}
    </div>`;

  $('#pRegen').onclick = ()=>{ planVariant=(planVariant+1)%6; renderPlan(); };
  $('#foodPlan').querySelectorAll('[data-eat]').forEach(b=> b.onclick = ()=>{
    const m = meals[+b.dataset.eat];
    const slot = SLOTS[Math.min(3, +b.dataset.eat)];
    m.rows.forEach(r=> Store.put('foods', { id:uid(), d:dayFood, slot,
      name:r.name, unit:r.unit, amount: /^100/.test(r.unit)? Math.round(r.units*100) : r.units,
      kcal:+r.k.toFixed(1), protein:+r.p.toFixed(1), fat:+r.f.toFixed(1), carb:+r.c.toFixed(1) }));
    toast(m.nm+' бүртгэлд нэмэгдлээ');
  });
}

/* ---- хоолны сан ---- */
function renderDB(){
  const cats = ['Бүгд', ...new Set(FOODS.map(f=>f.cat))];
  $('#dbCats').innerHTML = cats.map(c=>`<button data-c="${c}" aria-pressed="${c===dbCat}">${c}</button>`).join('');
  const list = FOODS.filter(f=>(dbCat==='Бүгд'||f.cat===dbCat) &&
    (!dbQ || f.n.toLowerCase().includes(dbQ) || f.cat.toLowerCase().includes(dbQ)));
  $('#dbTable').innerHTML = `
    <thead><tr><th>Бүтээгдэхүүн</th><th>Нэгж</th><th>Ккал</th><th>У</th><th>Ө</th><th>Н</th></tr></thead>
    <tbody>${list.length ? list.map(f=>`<tr>
      <td>${f.n}${f.nb?`<div style="font-size:11px;color:var(--muted);font-weight:400;margin-top:2px">${f.nb}</div>`:''}</td>
      <td style="color:var(--muted);font-size:12px">${f.u}</td>
      <td style="color:var(--text);font-weight:600">${f.k}</td>
      <td style="color:var(--s1)">${f.p}</td><td style="color:var(--s3)">${f.f}</td><td style="color:var(--s2)">${f.c}</td>
    </tr>`).join('') : `<tr><td colspan="6"><div class="empty">Илэрц олдсонгүй</div></td></tr>`}</tbody>`;
}

/* ═══════════ ДАСГАЛ ═══════════ */
function bindTrain(){
  $('#tPrev').onclick = ()=>{ dayTrain = shiftDate(dayTrain,-1); renderTrain(); };
  $('#tNext').onclick = ()=>{ dayTrain = shiftDate(dayTrain, 1); renderTrain(); };
}
function renderTrain(){
  if(!hasProfile()){
    $('#trainGate').innerHTML = `<div class="card"><div class="empty">
      Эхлээд <b>Профайл</b> хэсгээ бөглөнө үү.<br><br>
      <button class="btn sm" onclick="goTab('p-profile')">Профайл бөглөх</button></div></div>`;
    $('#trainMain').hidden = true; return;
  }
  $('#trainGate').innerHTML=''; $('#trainMain').hidden=false;

  const p = prof(), split = SPLITS[+p.days || 4];
  const fd = fmtDate(dayTrain);
  $('#tDateTxt').textContent = fd.isToday ? 'Өнөөдөр' : fd.long;
  $('#tDateSub').textContent = `${fd.long} · ${fd.wd}`;
  const rir = p.exp==='beg' ? 'RIR 3' : p.exp==='int' ? 'RIR 2' : 'RIR 1–2';
  $('#splitName').textContent = split.name;
  $('#splitDesc').textContent = split.desc + ' · ' + rir;

  const daySets = Store.list('sets', r=>r.d===dayTrain);
  const activeDay = daySets.length ? daySets[0].day_idx : null;

  $('#dayList').innerHTML = split.days.map((d,di)=>{
    const dSets = daySets.filter(s=>s.day_idx===di);
    const isOpen = activeDay===di || (activeDay===null && di===((new Date(dayTrain+'T00:00:00').getDay()+6)%split.days.length));
    return `<details class="day" ${isOpen?'open':''}>
      <summary>
        <div class="badge">${di+1}</div>
        <div><div class="nm">${d.nm}</div><div class="mg">${d.mg} · ${d.ex.length} дасгал${dSets.length?` · <span style="color:var(--good)">${dSets.length} сет бүртгэсэн</span>`:''}</div></div>
        <svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </summary>
      <div class="body">
        ${d.ex.map(([k,sets,reps])=>{
          const e = EX[k], id = di+'_'+k;
          const mine = dSets.filter(s=>s.exercise_key===k).sort((a,b)=>a.set_no-b.set_no);
          const prev = prevSession(k, dayTrain);
          return `<div class="ex">
            <div class="eh"><div class="en">${e.n}</div><div class="es">${sets} × ${reps}</div></div>
            <div class="ed">${e.m} — ${e.d}</div>
            ${prev ? `<div class="prev">Өмнөх (${prev.d}): ${prev.txt}${prev.e1?` · ойролц. 1RM ${prev.e1}кг`:''}</div>` : ''}
            <div class="setline">
              <input type="number" step="0.5" inputmode="decimal" placeholder="кг" id="w_${id}">
              <input type="number" inputmode="numeric" placeholder="давт." id="r_${id}">
              <button class="btn sm" data-log="${di}|${k}">+ Сет</button>
            </div>
            ${mine.length ? `<div class="setchips">${mine.map((s,i)=>
              `<span class="chip">${i+1}. ${s.weight}кг × ${s.reps}<button data-rm="${s.id}">✕</button></span>`).join('')}</div>` : ''}
          </div>`;
        }).join('')}
      </div></details>`;
  }).join('');

  $('#dayList').querySelectorAll('[data-log]').forEach(b=> b.onclick = ()=>{
    const [di,k] = b.dataset.log.split('|');
    const w = +$('#w_'+di+'_'+k).value, r = +$('#r_'+di+'_'+k).value;
    if(!w || !r) return toast('Жин ба давталтаа оруулна уу');
    const n = Store.list('sets', s=>s.d===dayTrain && s.day_idx===+di && s.exercise_key===k).length;
    Store.put('sets', { id:uid(), d:dayTrain, day_idx:+di, exercise_key:k, set_no:n+1, weight:w, reps:r, rir:null });
    toast(`${n+1}-р сет: ${w}кг × ${r}`);
  });
  $('#dayList').querySelectorAll('[data-rm]').forEach(b=> b.onclick = ()=> Store.remove('sets', b.dataset.rm));
}
function prevSession(exKey, beforeD){
  const all = Store.list('sets', s=>s.exercise_key===exKey && s.d < beforeD);
  if(!all.length) return null;
  const d = all.map(s=>s.d).sort().pop();
  const ss = all.filter(s=>s.d===d).sort((a,b)=>a.set_no-b.set_no);
  const best = ss.reduce((a,b)=> (b.weight*b.reps > a.weight*a.reps ? b : a));
  return { d, txt: ss.map(s=>`${s.weight}×${s.reps}`).join(', '), e1: epley(best.weight, best.reps) };
}

/* ═══════════ АХИЦ ═══════════ */
function bindProgress(){
  $('#progNav').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    [...$('#progNav').children].forEach(c=>c.setAttribute('aria-pressed', String(c===b)));
    $('#progWeight').hidden = b.dataset.v!=='w';
    $('#progMeas').hidden   = b.dataset.v!=='m';
    $('#progPhoto').hidden  = b.dataset.v!=='ph';
    renderProgress();
  });
  $('#mDate').value = todayISO();
  $('#phDate').value = todayISO();
  $('#btnAddM').onclick = ()=>{
    const d = $('#mDate').value, w = +$('#mW').value;
    if(!d) return toast('Огноогоо сонгоно уу');
    if(!w) return toast('Жингээ оруулна уу');
    const ex = Store.list('measurements', r=>r.d===d)[0];
    Store.put('measurements', { id: ex?.id || uid(), d, weight:w,
      chest:+$('#mChest').value||null, waist:+$('#mWaist').value||null,
      hip:+$('#mHip').value||null, arm:+$('#mArm').value||null, thigh:+$('#mThigh').value||null, note:'' });
    if(Math.abs(w - (+prof().weight||0)) > 0.05) Store.setProfile({ weight:w });
    ['#mW','#mChest','#mWaist','#mHip','#mArm','#mThigh'].forEach(s=> $(s).value='');
    toast('Хэмжилт хадгаллаа');
  };
  $('#phPick').onclick = ()=> $('#phFile').click();
  $('#phFile').addEventListener('change', async e=>{
    const f = e.target.files[0]; if(!f) return;
    $('#phPick').disabled = true; $('#phPick').textContent='Боловсруулж байна…';
    try{
      await Store.addPhoto(f, $('#phDate').value || todayISO(), $('#phNote').value.trim());
      $('#phNote').value=''; toast('Зураг нэмэгдлээ');
    }catch(err){ toast('Зураг нэмэхэд алдаа гарлаа'); console.error(err); }
    finally{ $('#phPick').disabled=false; $('#phPick').textContent='📷 Зураг нэмэх'; e.target.value=''; }
  });
}

function renderProgress(){
  const ms = Store.list('measurements').sort((a,b)=>a.d.localeCompare(b.d));
  const t  = targets();

  // чиг
  const el = $('#wTrend');
  if(ms.length>=2){
    const a=ms[0], b=ms[ms.length-1];
    const days=(new Date(b.d)-new Date(a.d))/864e5 || 1;
    const per=(b.weight-a.weight)/days*7;
    el.textContent = (per>0?'+':'')+per.toFixed(2)+' кг / 7 хоног';
    const goal = t ? t.rate : 0.2, g = prof().goal;
    const good = g==='bulk' ? (per>0 && per<=goal*1.6)
              : g==='cut'  ? (per<0 && Math.abs(per)<=goal*1.4)
              : Math.abs(per)<0.2;
    el.className = 'pill ' + (good?'g':'w');
  } else { el.textContent='Дор хаяж 2 хэмжилт хэрэгтэй'; el.className='pill'; }

  drawWeightChart(ms, t);

  // жингийн жагсаалт
  $('#wList').innerHTML = ms.length ? [...ms].reverse().map((m,i,arr)=>{
    const nx = arr[i+1], dw = nx ? m.weight-nx.weight : null;
    const fd = fmtDate(m.d);
    return `<div class="lrow"><div class="lm"><div class="lt">${nf(m.weight,1)} кг</div>
      <div class="ls">${fd.long} · ${fd.wd}</div></div>
      <div class="lv">${dw===null?'—':`<span style="color:${dw>0?'var(--good)':dw<0?'var(--warn)':'var(--muted)'}">${dw>0?'+':''}${nf(dw,1)} кг</span>`}</div>
      <button class="x" data-dm="${m.id}">✕</button></div>`;
  }).join('') : `<div class="empty">Хэмжилт алга. «Хэмжилт» хэсгээс нэмнэ үү.</div>`;
  $('#wList').querySelectorAll('[data-dm]').forEach(b=> b.onclick=()=>{ Store.remove('measurements', b.dataset.dm); toast('Устгалаа'); });

  // хэмжилтийн хүснэгт
  $('#mTable').innerHTML = ms.length ? `
    <thead><tr><th>Огноо</th><th>Жин</th><th>Цээж</th><th>Бэлхүүс</th><th>Ташаа</th><th>Гар</th><th>Гуя</th></tr></thead>
    <tbody>${[...ms].reverse().map(m=>`<tr><td>${m.d}</td><td>${nf(m.weight,1)}</td>
      <td>${m.chest?nf(m.chest,1):'—'}</td><td>${m.waist?nf(m.waist,1):'—'}</td>
      <td>${m.hip?nf(m.hip,1):'—'}</td><td>${m.arm?nf(m.arm,1):'—'}</td><td>${m.thigh?nf(m.thigh,1):'—'}</td></tr>`).join('')}</tbody>`
    : `<tbody><tr><td><div class="empty">Бүртгэл алга</div></td></tr></tbody>`;

  renderPhotos();
}

function drawWeightChart(M, t){
  const svg = $('#wChart');
  const W=640,H=300,L=46,R=18,T=18,B=34;
  if(M.length<2){
    svg.innerHTML = `<text x="${W/2}" y="${H/2}" text-anchor="middle" fill="#898781" font-size="14">Хоёр ба түүнээс дээш хэмжилт оруулбал график гарна</text>`;
    $('#wLegend').innerHTML=''; return;
  }
  const t0 = new Date(M[0].d).getTime();
  const xs = M.map(m=> (new Date(m.d).getTime()-t0)/864e5);
  const maxX = Math.max(...xs, 7);
  const rate = t ? (prof().goal==='cut' ? -t.rate : prof().goal==='bulk' ? t.rate : 0) : 0;
  const proj = xs.map(x=> M[0].weight + rate*x/7);
  const all = [...M.map(m=>m.weight), ...proj];
  let lo=Math.min(...all), hi=Math.max(...all);
  const pad = Math.max(0.8,(hi-lo)*0.28); lo-=pad; hi+=pad;
  const X = v => L + v/maxX*(W-L-R);
  const Y = v => T + (hi-v)/(hi-lo)*(H-T-B);

  let g='';
  for(let i=0;i<=5;i++){
    const v = lo+(hi-lo)*i/5, y=Y(v);
    g += `<line class="gl" x1="${L}" y1="${y.toFixed(1)}" x2="${W-R}" y2="${y.toFixed(1)}"/>
          <text x="${L-9}" y="${(y+4).toFixed(1)}" text-anchor="end">${v.toFixed(1)}</text>`;
  }
  g += `<line class="ax" x1="${L}" y1="${H-B}" x2="${W-R}" y2="${H-B}"/>`;
  const lab = i=>{ const d=new Date(M[i].d+'T00:00:00'); return (d.getMonth()+1)+'/'+d.getDate(); };
  const idxs = M.length<=6 ? M.map((_,i)=>i) : [0, Math.floor(M.length/3), Math.floor(M.length*2/3), M.length-1];
  idxs.forEach(i=> g += `<text x="${X(xs[i]).toFixed(1)}" y="${H-B+20}" text-anchor="middle">${lab(i)}</text>`);

  const path = a => a.map((y,i)=> (i?'L':'M')+X(xs[i]).toFixed(1)+' '+Y(y).toFixed(1)).join(' ');
  let p='';
  if(rate!==0) p += `<path class="line" d="${path(proj)}" stroke="var(--muted)" stroke-dasharray="5 5" stroke-width="1.6"/>`;
  p += `<path class="line" d="${path(M.map(m=>m.weight))}" stroke="var(--s1)"/>`;
  M.forEach((m,i)=> p += `<circle class="pt" cx="${X(xs[i]).toFixed(1)}" cy="${Y(m.weight).toFixed(1)}" r="4.5" fill="var(--s1)"><title>${m.d}: ${m.weight} кг</title></circle>`);
  const last = M[M.length-1];
  p += `<text x="${(X(xs[xs.length-1])-6).toFixed(1)}" y="${(Y(last.weight)-13).toFixed(1)}" text-anchor="end" fill="#fff" font-size="12.5" font-weight="600">${last.weight} кг</text>`;
  svg.innerHTML = g+p;
  $('#wLegend').innerHTML = `<i><span class="dot" style="background:var(--s1)"></span>Бодит жин</i>` +
    (rate!==0 ? `<i><span style="width:14px;height:2px;background:var(--muted);display:inline-block"></span>Зорилтот чиг (${rate>0?'+':''}${rate} кг/7 хоног)</i>` : '');
}

let photoSig = null;
async function renderPhotos(){
  const ph = Store.list('photos').sort((a,b)=>a.d.localeCompare(b.d));
  const grid = $('#phGrid');
  const sig = ph.map(p=>p.id+':'+(p.path?1:0)).join(',');
  if(sig === photoSig) return;          // өөрчлөгдөөгүй бол дахин ачаалахгүй
  photoSig = sig;
  if(!ph.length){ grid.innerHTML = `<div class="empty" style="grid-column:1/-1">Зураг алга. Дээрх товчоор нэмнэ үү.</div>`; return; }
  grid.innerHTML = ph.map(p=>`<div class="pcell" data-id="${p.id}">
      <div class="empty" style="padding:0;height:100%;display:grid;place-items:center;font-size:11px">…</div>
      <button class="pdel" data-dp="${p.id}">✕</button>
      <div class="pd">${p.d}${p.note?' · '+p.note:''}</div></div>`).join('');
  grid.querySelectorAll('[data-dp]').forEach(b=> b.onclick=(e)=>{ e.stopPropagation(); Store.remove('photos', b.dataset.dp); toast('Устгалаа'); });
  for(const p of ph){
    const cell = grid.querySelector(`.pcell[data-id="${p.id}"]`);
    if(!cell) continue;
    let src = null;
    const blob = await Store.photoThumb(p.id);
    if(blob) src = URL.createObjectURL(blob);
    else src = await Store.photoURL(p);
    if(src){ const img=new Image(); img.src=src; img.alt=p.d; cell.querySelector('.empty')?.replaceWith(img); }
    else cell.querySelector('.empty').textContent = 'Ачаалж чадсангүй';
  }
}

/* ═══════════ ДАНС / НӨӨЦ ═══════════ */
let installEvt = null;
function bindAccount(){
  $('#btnExport').onclick = ()=>{
    const blob = new Blob([Store.exportJSON()], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'huch-nooc-' + todayISO() + '.json';
    a.click(); URL.revokeObjectURL(a.href);
    toast('Нөөц татлаа');
  };
  $('#btnImport').onclick = ()=> $('#fileIn').click();
  $('#fileIn').addEventListener('change', e=>{
    const f=e.target.files[0]; if(!f) return;
    const rd=new FileReader();
    rd.onload=()=>{ try{ Store.importJSON(rd.result); toast('Сэргээлээ'); }
                    catch(err){ toast('Файл уншиж чадсангүй'); } };
    rd.readAsText(f); e.target.value='';
  });
  $('#btnOut').onclick = async ()=>{
    if(!confirm('Гарах уу? Синк хийгдээгүй өгөгдөл байвал алдагдаж болно.')) return;
    localStorage.removeItem('huch.mode');
    await Store.signOut(); route();
  };
  window.addEventListener('beforeinstallprompt', e=>{
    e.preventDefault(); installEvt = e; $('#installCard').hidden = false;
  });
  $('#btnInstall').onclick = async ()=>{
    if(!installEvt) return;
    installEvt.prompt(); await installEvt.userChoice;
    installEvt = null; $('#installCard').hidden = true;
  };
  if(/iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone){
    $('#installCard').hidden = false;
    $('#btnInstall').outerHTML = `<div class="note-box" style="margin:0">
      <b>iPhone дээр:</b> Safari-гийн доод талын <b>Хуваалцах</b> (↑) товчийг дараад
      <b>«Add to Home Screen»</b> сонгоно уу.</div>`;
  }
}
function renderAccount(){
  const dot = $('#syncDot');
  if(!Store.cloud || !Store.user){
    dot.className='sync-dot off';
    $('#hdrSub').textContent = 'Оффлайн горим';
    $('#acctInfo').innerHTML = Store.cloud
      ? 'Бүртгэлгүй ашиглаж байна — өгөгдөл зөвхөн энэ төхөөрөмжид. <b style="color:var(--text)">Гарах</b> дарж бүртгүүлж болно.'
      : 'Supabase тохируулаагүй байна (<code>js/config.js</code>). Апп бүрэн ажиллах боловч өгөгдөл зөвхөн энэ төхөөрөмжид хадгалагдана.';
    $('#btnOut').textContent = Store.cloud ? 'Нэвтрэх дэлгэц рүү очих' : 'Өгөгдлийг цэвэрлэх';
  } else {
    dot.className = 'sync-dot ' + (Store.syncing?'busy' : Store.lastError?'err' : Store.online?'ok':'off');
    $('#hdrSub').textContent = Store.online ? (Store.syncing?'Синк хийж байна…':'Синк идэвхтэй') : 'Сүлжээгүй';
    const pend = ['measurements','sets','foods','photos'].reduce((a,c)=>a+Store.data[c].filter(r=>r._dirty).length,0)
                 + (Store.data.profile?._dirty?1:0);
    $('#acctInfo').innerHTML = `<b style="color:var(--text)">${Store.user.email}</b><br>
      ${Store.lastSync ? 'Сүүлд синк: '+Store.lastSync.toLocaleTimeString('mn-MN',{hour:'2-digit',minute:'2-digit'}) : 'Хараахан синк хийгээгүй'}
      ${pend ? ` · <span class="pill w">${pend} мөр хүлээгдэж байна</span>` : ' · <span class="pill g">бүгд хадгалагдсан</span>'}
      ${Store.lastError ? `<br><span style="color:#ff8080">${Store.lastError}</span>` : ''}`;
    $('#btnOut').textContent = 'Гарах';
  }
}

/* ═══════════ RENDER ALL ═══════════ */
let raf = null;
const focusIn = sel => { const a=document.activeElement; return !!(a && a.closest && a.closest(sel)); };
function renderAll(){
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(()=>{
    // Хэрэглэгч бичиж байгаа талбарыг дахин зурж, оруулсныг нь арчихгүй
    if(!focusIn('#p-profile')) fillProfileForm();
    renderTargets();
    renderToday();
    if(!focusIn('#sheetHost')) renderFood();
    if(!focusIn('#dayList'))   renderTrain();
    if(!focusIn('#progMeas'))  renderProgress();
    renderAccount();
  });
}

/* ═══════════ SERVICE WORKER ═══════════ */
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('./sw.js').catch(e=>console.warn('SW:', e.message)));
}
