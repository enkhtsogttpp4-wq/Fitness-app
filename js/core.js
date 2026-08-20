/* ═══════════════════════════════════════════════════════════════
   Фитнесс зөвлөгөө, тэмдэглэл — тооцооллын цөм
   • BMR / TDEE / илчлэг / макро
   • Өдрийн хоолны цэс үүсгэгч (порцын бодит хязгаартай)
   Энэ файл DOM-д хамааралгүй — цэвэр функцууд.
   ═══════════════════════════════════════════════════════════════ */

/* ───────── 1. ТООЦООЛОЛ ───────── */
function calcTargets(p){
  // Mifflin-St Jeor
  const bmr  = Math.round(10*p.weight + 6.25*p.height - 5*p.age + (p.sex==='m'?5:-161));
  const tdee = Math.round(bmr * p.activity * (1 + p.days*0.028));
  const lbm  = p.bodyFat ? +(p.weight*(1-p.bodyFat/100)).toFixed(1) : null;
  const bmi  = +(p.weight/Math.pow(p.height/100,2)).toFixed(1);

  let kcal, rate, rateTxt;
  if(p.goal==='bulk'){
    const pct = p.exp==='beg'?0.15 : p.exp==='int'?0.12 : 0.10;
    kcal = Math.round(tdee*(1+pct));
    rate = +(p.weight * (p.exp==='beg'?0.004 : p.exp==='int'?0.003 : 0.002)).toFixed(2);
    rateTxt = '+'+rate+' кг';
  } else if(p.goal==='cut'){
    kcal = Math.round(tdee*0.78);
    rate = +(p.weight*0.007).toFixed(2);
    rateTxt = '−'+rate+' кг';
  } else {
    kcal = tdee; rate = 0; rateTxt = 'Тогтмол';
  }

  // Эрүүл мэндийн доод хязгаар
  const floorK = Math.max(Math.round(bmr*1.05), p.sex==='m'?1500:1200);
  const floored = kcal < floorK;
  if(floored) kcal = floorK;

  const base = lbm || p.weight;
  let pro, fat;
  if(p.goal==='cut')       { pro = Math.round(base*2.4); fat = Math.round(p.weight*0.8); }
  else if(p.goal==='bulk') { pro = Math.round(base*2.0); fat = Math.round(p.weight*1.0); }
  else                     { pro = Math.round(base*2.2); fat = Math.round(p.weight*0.9); }
  pro = Math.min(pro, Math.round(kcal*0.40/4));

  let carb = Math.round((kcal - pro*4 - fat*9)/4);
  if(carb < 80){
    const need = (80-carb)*4;
    fat = Math.max(Math.round(p.weight*0.6), fat - Math.round(need/9));
    carb = Math.round((kcal - pro*4 - fat*9)/4);
  }
  return {
    bmr, tdee, kcal, pro, fat, carb, lbm, bmi, rate, rateTxt, floored,
    water: +(p.weight*0.04).toFixed(1),
    fiber: Math.round(kcal/1000*14),
  };
}

/* ───────── 2. ХООЛНЫ ЦЭС ҮҮСГЭГЧ ───────── */
const F = n => FOODS.find(x=>x.n===n);
const isPer100 = it => /^100/.test(it.u);
const clamp = (v,a,b)=> Math.min(b, Math.max(a,v));

const POOLS = {
  bfCarb:["Овъёос (түүхий)","Хар талх","Цагаан будаа (чанасан)","Овъёос (түүхий)","Тост талх (бүхэл үрийн)","Овъёос (түүхий)"],
  pro:   ["Үхрийн мах (туранхай)","Тахианы цээж (яс, арьсгүй)","Хонины гуяны мах (туранхай)","Ямааны мах",
          "Хадран / омуль (Хөвсгөлийн загас)","Адууны мах"],
  carb:  ["Цагаан будаа (чанасан)","Төмс (чанасан)","Хар будаа / гречка (чанасан)","Гоймон (чанасан)",
          "Цагаан будаа (чанасан)","Макарон (чанасан)"],
  veg:   ["Цагаан байцаа","Лууван","Улаан лооль","Ногоон вандуй (хөлдөөсөн)","Өргөст хэмх","Чинжүү (болгар)",
          "Хөлдөөсөн ногооны холимог","Брокколи"],
  fat:   ["Чидун жимсний тос","Хушганы самар","Наранцэцгийн тос","Самрын цөцгий (арахисын)","Бүйлс (миндаль)","Чидун жимсний тос"],
  snack: ["Ааруул","Борц (хатаасан мах)","Whey уургийн нунтаг","Шар суу / творог (5%)","Ааруул","Тунецын консерв (усанд)"],
  fruit: ["Алим","Гадил","Алим","Жүрж","Гадил","Лийр"],
  dairy: ["Сүү (тослоггүй)","Тараг (энгийн, чихэргүй)","Сүү (тослоггүй)","Кефир","Тараг (энгийн, чихэргүй)","Сүү 2.5%"],
};
const pick = (pool,i)=> POOLS[pool][((i%POOLS[pool].length)+POOLS[pool].length)%POOLS[pool].length];

/* Бодит амьдралд боломжтой порцын хязгаар [доод, дээд] нэгжээр */
const CAP = {
  "Овъёос (түүхий)":[0.3,2.0], "Цагаан будаа (чанасан)":[0.5,6.0],
  "Хар будаа / гречка (чанасан)":[0.5,6.0], "Гоймон (чанасан)":[0.5,5.5],
  "Макарон (чанасан)":[0.5,5.5], "Төмс (чанасан)":[0.5,6.5],
  "Хар талх":[1,5], "Цагаан талх":[1,5], "Тост талх (бүхэл үрийн)":[1,5],
  "Ааруул":[0.2,1.2], "Борц (хатаасан мах)":[0.15,1.0],
  "Шар суу / творог (5%)":[0.5,3.0], "Тунецын консерв (усанд)":[0.5,2],
  "Сүү (тослоггүй)":[1.0,5.0], "Сүү 2.5%":[1.0,4.0], "Сүү 3.2%":[1.0,4.0],
  "Тараг (энгийн, чихэргүй)":[1.0,4.0], "Кефир":[1.0,4.0],
  "Хушганы самар":[0.1,0.6], "Бүйлс (миндаль)":[0.1,0.6],
  "Whey уургийн нунтаг":[1,3], "Өндөг":[1,5],
  "Алим":[1,3], "Гадил":[1,3], "Жүрж":[1,3], "Лийр":[1,2],
};
function capOf(item, role){
  if(CAP[item.n]) return CAP[item.n];
  if(isPer100(item)) return role==='pro' ? [0.6,3.0] : role==='carb' ? [0.4,5.0]
                          : role==='fat' ? [0.05,0.6] : [1.0,2.5];
  return role==='fat' ? [0.5,3] : [1,4];
}

function amountLabel(item, units){
  if(!(units>0)) return {txt:'', units:0};
  if(isPer100(item)){
    const g = Math.round(units*100/5)*5;
    if(g < 5) return {txt:'', units:0};
    return {txt: g + (item.u.includes('мл')?' мл':' г'), units: g/100};
  }
  const whole = /^1ш|зүсэм|хэмжүүр|сав|капсул|хэрчим/.test(item.u);
  const n = whole ? Math.round(units) : Math.round(units*2)/2;
  if(n <= 0) return {txt:'', units:0};
  let lbl;
  if(/^1ш/.test(item.u))        lbl = 'ш';
  else if(/^\d+ш/.test(item.u)) lbl = '× ' + item.u;
  else if(/^1\s/.test(item.u))  lbl = item.u.slice(1).replace(/\(.*\)/,'').trim();
  else                          lbl = '× ' + item.u;
  return {txt: n + ' ' + lbl, units: n};
}
function setUnits(row, raw){
  const u = raw < row.cap[0]*0.6 ? 0 : clamp(raw, row.cap[0], row.cap[1]);
  const a = amountLabel(row.item, u);
  row.units=a.units; row.amt=a.txt;
  row.k=row.item.k*a.units; row.p=row.item.p*a.units;
  row.f=row.item.f*a.units; row.c=row.item.c*a.units;
}
function addRow(list, item, units, role){
  if(!item || !(units>0)) return {k:0,p:0,f:0,c:0};
  const cap = capOf(item, role);
  const a = amountLabel(item, clamp(units, cap[0], cap[1]));
  if(a.units<=0) return {k:0,p:0,f:0,c:0};
  const r = {item, name:item.n, unit:item.u, role, cap, units:a.units, amt:a.txt,
             k:item.k*a.units, p:item.p*a.units, f:item.f*a.units, c:item.c*a.units};
  list.push(r); return r;
}
const scaleFor = (item, key, target)=> (!item || !item[key] || item[key]<=0) ? 0 : target/item[key];

/* Нийт дүнг зорилтод нийцүүлэн нарийвчлах */
function tunePlan(meals, tgt){
  const rows  = ()=> meals.flatMap(m=>m.rows);
  const total = ()=> rows().reduce((a,r)=>({k:a.k+r.k,p:a.p+r.p,f:a.f+r.f,c:a.c+r.c}),{k:0,p:0,f:0,c:0});
  const fix = (role,key,target,tol)=>{
    for(let pass=0; pass<3; pass++){
      let d = target - total()[key];
      if(Math.abs(d) < tol) return;
      const cand = rows().filter(r=>r.role===role && r.item[key] > 0).sort((a,b)=>
        d>0 ? (b.cap[1]-b.units)*b.item[key] - (a.cap[1]-a.units)*a.item[key] : b[key]-a[key]);
      if(!cand.length) return;
      for(const r of cand){
        if(Math.abs(d) < tol) break;
        setUnits(r, Math.max(0, r.units + d/r.item[key]));
        d = target - total()[key];
      }
    }
  };
  for(let i=0;i<4;i++){ fix('pro','p',tgt.p,1); fix('fat','f',tgt.f,1); fix('carb','c',tgt.c,1); }
  fix('carb','k',tgt.k,10);
  fix('pro','p',tgt.p,2);
  meals.forEach(m=>{
    m.rows = m.rows.filter(r=>r.units>0);
    m.tot  = m.rows.reduce((a,r)=>({k:a.k+r.k,p:a.p+r.p,f:a.f+r.f,c:a.c+r.c}),{k:0,p:0,f:0,c:0});
  });
  return meals;
}

/* [нэр, уураг%, нүүрс ус%, өөх%, төрөл] */
const MEALPLANS = {
  3:[["Өглөө",.30,.30,.35,'bf'],["Өдөр",.35,.35,.35,'main'],["Орой",.35,.35,.30,'main']],
  4:[["Өглөө",.25,.25,.30,'bf'],["Өдөр",.30,.30,.30,'main'],["Үдээс хойш (зууш)",.15,.15,.15,'snack'],["Орой",.30,.30,.25,'main']],
  5:[["Өглөө",.22,.20,.28,'bf'],["Өглөө–өдрийн зууш",.13,.12,.12,'snack'],["Өдөр",.27,.26,.28,'main'],["Дасгалын дараа",.13,.17,.05,'post'],["Орой",.25,.25,.27,'main']],
};

function buildPlan(t, mealsPerDay, variant){
  const v = variant|0;
  const tpl = MEALPLANS[mealsPerDay] || MEALPLANS[4];
  const meals = [];

  tpl.forEach((m,mi)=>{
    const [nm, pw, cw, fw, kind] = m;
    const tP = t.pro*pw, tC = t.carb*cw, tF = t.fat*fw;
    const rows = []; const acc = {k:0,p:0,f:0,c:0};
    const add = (it,u,role)=>{ const r=addRow(rows,it,u,role);
      acc.k+=r.k||0; acc.p+=r.p||0; acc.f+=r.f||0; acc.c+=r.c||0; };

    /* Дараалал: нүүрс ус/ногоо → үлдсэн уургийг махаар → өөхний үлдэгдэл.
       Ингэснээр нийлбэр зорилтоос хэтрэхгүй. */
    if(kind==='bf'){
      add(F(pick('bfCarb',v)), scaleFor(F(pick('bfCarb',v)),'c', tC*0.8), 'carb');
      if(tC-acc.c > 30) add(F("Хар талх"), scaleFor(F("Хар талх"),'c', tC-acc.c), 'carb');
      const e = F("Өндөг");
      add(e, clamp(Math.round((tP-acc.p)*0.6/e.p), 1, 4), 'pro');
      const remP = tP - acc.p;
      if(remP > 3) add(F(remP>22 ? "Whey уургийн нунтаг" : pick('dairy',v)),
                       scaleFor(F(remP>22 ? "Whey уургийн нунтаг" : pick('dairy',v)),'p', remP), 'pro');
    }
    else if(kind==='snack'){
      const sn = F(pick('snack', v+mi));
      add(sn, scaleFor(sn,'p', tP), 'pro');
      if(tC-acc.c > 8){ const fr=F(pick('fruit',v+mi)); add(fr, scaleFor(fr,'c', tC-acc.c), 'carb'); }
    }
    else if(kind==='post'){
      const w = F("Whey уургийн нунтаг"); add(w, scaleFor(w,'p',tP), 'pro');
      if(tC-acc.c > 5){ const fr=F(v%2?"Гадил":"Алим"); add(fr, scaleFor(fr,'c', tC-acc.c), 'carb'); }
    }
    else {
      add(F(pick('veg', v+mi*2)), 1.5, 'veg');
      const carb = F(pick('carb', v+mi));
      add(carb, scaleFor(carb,'c', Math.max(0, tC-acc.c)), 'carb');
      if(tC-acc.c > 30) add(F("Хар талх"), scaleFor(F("Хар талх"),'c', tC-acc.c), 'carb');
      const meat = F(pick('pro', v+mi));
      add(meat, scaleFor(meat,'p', Math.max(0, tP-acc.p)), 'pro');
    }
    const remF = tF - acc.f;
    if(remF > 1){ const ft=F(pick('fat',v+mi)); add(ft, scaleFor(ft,'f', remF), 'fat'); }
    meals.push({nm, rows, tot:acc});
  });
  return tunePlan(meals, {p:t.pro, f:t.fat, c:t.carb, k:t.kcal});
}

/* ───────── 3. ТУСЛАХ ───────── */
const BMI_LABEL = v => v<18.5?'Туранхай' : v<25?'Хэвийн' : v<30?'Илүүдэлтэй' : 'Таргалалт';
// Эпли томьёо — ойролцоо 1RM
const epley = (w,r)=> r<=1 ? w : Math.round(w*(1+r/30));
// Давталтын мужаас амралтын хугацаа санал болгох (бага давталт = хүнд жин = урт амралт)
function restHint(reps){
  const lo = parseInt(reps, 10) || 10;
  if(lo <= 5)  return {sec:180, txt:'2–3 мин'};
  if(lo <= 8)  return {sec:120, txt:'90 сек – 2 мин'};
  if(lo <= 12) return {sec:90,  txt:'60–90 сек'};
  return {sec:60, txt:'45–60 сек'};
}
const todayISO = ()=> new Date().toLocaleDateString('sv-SE');   // YYYY-MM-DD, локал цагаар
const uid = ()=> (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{
      const r=Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); }));
