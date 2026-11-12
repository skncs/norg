/* ============================================================
   Norg · 状态与计算引擎
   localStorage 持久化 + TDEE / 宏量 / e1RM / 统计聚合
   ============================================================ */
(function (global) {
  'use strict';

  const KEY = 'norg.v1';

  /* ---------- 工具 ---------- */
  const pad = n => String(n).padStart(2, '0');
  const todayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dayOffset = (k, n) => {
    const d = new Date(k + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return todayKey(d);
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = (v, n = 0) => { const p = Math.pow(10, n); return Math.round(v * p) / p; };
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------- 默认档案 ---------- */
  function defaultState() {
    return {
      v: 1,
      profile: {
        name: '训练者',
        sex: 'male',
        age: 25,
        height: 175,
        weight: 70,
        targetWeight: 65,
        activity: 1.375,      // 活动系数
        goalRate: -0.5,       // kg / 周
        goalType: 'cut',      // cut / maintain / bulk
        proteinPerKg: 2.0,
        fatPct: 0.25,
        theme: 'crimson',
        unit: 'kg',
      },
      days: {},        // { '2026-11-12': { meals:[], workouts:[], weight:null, water:0, sleep:null, steps:0 } }
      prs: {},         // { exerciseId: { weight, reps, e1rm, date } }
      streak: 0,
      lastLog: null,
      achievements: [],
      customFoods: [],
    };
  }

  /* ---------- 读写 ---------- */
  let S = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) { S = defaultState(); seed(); return S; }
      S = JSON.parse(raw);
      // 迁移/补全
      const d = defaultState();
      S.profile = Object.assign({}, d.profile, S.profile || {});
      S.days = S.days || {};
      S.prs = S.prs || {};
      S.achievements = S.achievements || [];
      S.customFoods = S.customFoods || [];
      return S;
    } catch (e) {
      S = defaultState(); seed(); return S;
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {}
  }

  /* ---------- 首次体验：注入 30 天演示数据 ---------- */
  function seed() {
    const t = todayKey();
    const foods = global.NORG_DATA.FOODS;
    const find = n => foods.find(f => f.name === n);

    /* 1) 30 天体重曲线：从 87.6 缓慢降到 85.0，带自然波动 */
    const w0 = 87.6, w1 = 85.0;
    for (let i = 29; i >= 0; i--) {
      const k = dayOffset(t, -i);
      if (!S.days[k]) S.days[k] = { meals: [], workouts: [], weight: null, water: 0, sleep: null, steps: 0 };
      const prog = (29 - i) / 29;
      const base = w0 + (w1 - w0) * prog;
      // 每 7 天一个平台期，加 ±0.25 抖动
      const wobble = Math.sin((29 - i) / 7 * Math.PI * 2) * 0.22 + Math.sin((29 - i) * 1.7) * 0.1;
      S.days[k].weight = round(base + wobble, 1);
      S.days[k].sleep = round(6.2 + Math.abs(Math.sin(i * 0.9)) * 1.8, 1);
      S.days[k].steps = 5500 + Math.round(Math.abs(Math.sin(i * 1.3)) * 5000);
      S.days[k].water = 1500 + Math.round(Math.abs(Math.cos(i * 0.8)) * 1200);
    }
    // 今天体重固定为 85.0
    S.days[t].weight = 85.0;

    /* 2) 最近 7 天的饮食记录 */
    const plan = [
      { off: -6, meals: [['燕麦片', 60], ['牛奶', 250], ['鸡蛋', 100], ['鸡胸肉', 180], ['米饭', 250], ['西兰花', 200], ['三文鱼', 130]] },
      { off: -5, meals: [['全麦面包', 70], ['鸡蛋', 100], ['鸡胸肉', 200], ['糙米饭', 250], ['菠菜', 150], ['牛肉丸', 100]] },
      { off: -4, meals: [['燕麦片', 60], ['乳清蛋白粉', 30], ['米饭', 200], ['牛里脊', 180], ['黄瓜', 150], ['苹果', 200]] },
      { off: -3, meals: [['馒头', 100], ['鸡蛋', 100], ['鸡腿肉', 200], ['红薯', 200], ['生菜', 100], ['无糖希腊酸奶', 150]] },
      { off: -2, meals: [['燕麦片', 50], ['牛奶', 250], ['猪里脊', 180], ['意大利面', 250], ['番茄', 150], ['香蕉', 120]] },
      { off: -1, meals: [['全麦面包', 60], ['鸡蛋', 100], ['鸡胸肉', 200], ['糙米饭', 220], ['西兰花', 180], ['蓝莓', 100]] },
      { off: 0,  meals: [['燕麦片', 50], ['牛奶', 250], ['鸡蛋', 50], ['鸡胸肉', 200], ['米饭', 250], ['西兰花', 200]] },
    ];

    plan.forEach(p => {
      const k = dayOffset(t, p.off);
      const meals = [];
      const slots = ['早餐', '早餐', '午餐', '午餐', '晚餐', '加餐', '加餐'];
      p.meals.forEach((m, i) => {
        const f = find(m[0]);
        if (!f) return;
        const grams = m[1];
        meals.push({
          id: uid(),
          foodId: f.id,
          name: f.name,
          grams,
          kcal: round(f.kcal * grams / 100),
          p: round(f.p * grams / 100, 1),
          c: round(f.c * grams / 100, 1),
          f: round(f.f * grams / 100, 1),
          slot: slots[i] || '加餐',
          ts: Date.now() - (6 - p.off) * 864e5,
        });
      });
      S.days[k].meals = meals;
    });

    /* 3) 训练记录：最近 3 次 */
    [[-6, 'push'], [-3, 'pull'], [-1, 'legs']].forEach(([off, kind]) => {
      const k = dayOffset(t, off);
      S.days[k].workouts = [makeWorkout(kind)];
    });
    // 今天也给一次训练，让今日训练页有内容
    S.days[t].workouts = [makeWorkout('push')];

    /* 4) 个人纪录（按动作名定位，避免 ID 漂移） */
    const EXS = global.NORG_DATA.EXERCISES;
    const byName = n => EXS.find(e => e.name === n);
    const prSet = (name, weight, reps, off) => {
      const ex = byName(name);
      if (!ex) return;
      S.prs[ex.id] = { weight, reps, e1rm: e1rm(weight, reps), date: dayOffset(t, off) };
    };
    prSet('杠铃平板卧推', 80, 5, -1);
    prSet('杠铃深蹲', 110, 6, -1);
    prSet('硬拉', 130, 5, -6);
    prSet('高位下拉', 65, 8, -3);
    prSet('腿举', 150, 8, -6);

    S.streak = 12;
    S.lastLog = t;
    save();
  }

  function makeWorkout(kind) {
    const EX = global.NORG_DATA.EXERCISES;
    const pick = names => names.map(n => EX.find(e => e.name === n)).filter(Boolean);
    const sets = (ex, base, n) => {
      if (!ex) return null;
      const arr = [];
      for (let i = 0; i < n; i++) {
        arr.push({ id: uid(), weight: round(base * (1 + i * 0.025), 1), reps: [10, 9, 8, 7][i] || 8, done: true });
      }
      return { exId: ex.id, name: ex.name, sets: arr };
    };
    let list = [];
    if (kind === 'push') {
      list = [
        sets(EX.find(e => e.name === '杠铃平板卧推'), 70, 4),
        sets(EX.find(e => e.name === '上斜哑铃卧推'), 24, 3),
        sets(EX.find(e => e.name === '哑铃侧平举'), 10, 3),
        sets(EX.find(e => e.name === '绳索下压'), 25, 3),
      ];
    } else if (kind === 'pull') {
      list = [
        sets(EX.find(e => e.name === '高位下拉'), 60, 4),
        sets(EX.find(e => e.name === '杠铃划船'), 65, 4),
        sets(EX.find(e => e.name === '面拉'), 20, 3),
        sets(EX.find(e => e.name === '哑铃交替弯举'), 14, 3),
      ];
    } else {
      list = [
        sets(EX.find(e => e.name === '杠铃深蹲'), 90, 4),
        sets(EX.find(e => e.name === '罗马尼亚硬拉'), 70, 3),
        sets(EX.find(e => e.name === '腿举'), 140, 3),
        sets(EX.find(e => e.name === '站姿提踵'), 50, 4),
      ];
    }
    return {
      id: uid(),
      name: kind === 'push' ? '推日 · 胸肩三头' : kind === 'pull' ? '拉日 · 背二头' : '腿日 · 下肢',
      ts: Date.now(),
      dur: 55 + Math.round(Math.random() * 25),
      exercises: list.filter(Boolean),
    };
  }

  /* ---------- 日数据 ---------- */
  function day(k) {
    k = k || todayKey();
    if (!S.days[k]) S.days[k] = { meals: [], workouts: [], weight: null, water: 0, sleep: null, steps: 0 };
    const d = S.days[k];
    d.meals = d.meals || [];
    d.workouts = d.workouts || [];
    if (d.water == null) d.water = 0;
    if (d.steps == null) d.steps = 0;
    return d;
  }

  /* ---------- 目标计算 ---------- */
  function calcTargets() {
    const p = S.profile;
    // Mifflin-St Jeor
    const bmr = p.sex === 'male'
      ? 10 * p.weight + 6.25 * p.height - 5 * p.age + 5
      : 10 * p.weight + 6.25 * p.height - 5 * p.age - 161;
    const tdee = bmr * p.activity;
    // 1kg 脂肪 ≈ 7700 kcal
    const dailyDelta = (p.goalRate * 7700) / 7;
    let kcal = tdee + dailyDelta;
    kcal = clamp(kcal, bmr * 1.05, tdee * 1.6);
    kcal = Math.round(kcal / 10) * 10;

    const protein = Math.round(p.weight * p.proteinPerKg);
    const fat = Math.round((kcal * p.fatPct) / 9);
    const carb = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      kcal,
      protein, fat, carb,
      delta: Math.round(dailyDelta),
    };
  }

  /* ---------- 日汇总 ---------- */
  function dayTotals(k) {
    const d = day(k);
    const t = { kcal: 0, p: 0, c: 0, f: 0 };
    d.meals.forEach(m => { t.kcal += m.kcal; t.p += m.p; t.c += m.c; t.f += m.f; });
    t.kcal = Math.round(t.kcal);
    t.p = round(t.p, 1); t.c = round(t.c, 1); t.f = round(t.f, 1);
    return t;
  }

  function workoutVolume(w) {
    if (!w || !w.exercises) return 0;
    let v = 0;
    w.exercises.forEach(ex => {
      (ex.sets || []).forEach(s => { if (s.done) v += (s.weight || 0) * (s.reps || 0); });
    });
    return Math.round(v);
  }

  function workoutSets(w) {
    if (!w || !w.exercises) return 0;
    let n = 0;
    w.exercises.forEach(ex => { n += (ex.sets || []).filter(s => s.done).length; });
    return n;
  }

  function dayVolume(k) {
    return day(k).workouts.reduce((a, w) => a + workoutVolume(w), 0);
  }

  /* ---------- e1RM (Epley) ---------- */
  function e1rm(weight, reps) {
    if (!weight || !reps) return 0;
    if (reps === 1) return weight;
    return round(weight * (1 + reps / 30), 1);
  }

  /* ---------- 记录一餐 ---------- */
  function addMeal(k, food, grams, slot) {
    const d = day(k);
    const g = Number(grams) || food.serving;
    const item = {
      id: uid(),
      foodId: food.id,
      name: food.name,
      grams: g,
      kcal: round(food.kcal * g / 100),
      p: round(food.p * g / 100, 1),
      c: round(food.c * g / 100, 1),
      f: round(food.f * g / 100, 1),
      slot: slot || slotOfNow(),
      ts: Date.now(),
    };
    d.meals.push(item);
    bumpStreak(k);
    save();
    return item;
  }

  function removeMeal(k, id) {
    const d = day(k);
    d.meals = d.meals.filter(m => m.id !== id);
    save();
  }

  function slotOfNow() {
    const h = new Date().getHours();
    if (h < 10) return '早餐';
    if (h < 15) return '午餐';
    if (h < 20) return '晚餐';
    return '加餐';
  }

  /* ---------- 记录体重 ---------- */
  function setWeight(k, kg) {
    const d = day(k);
    d.weight = Number(kg);
    S.profile.weight = Number(kg);
    save();
  }

  /* ---------- 连续打卡 ---------- */
  function bumpStreak(k) {
    if (S.lastLog === k) return;
    if (S.lastLog === dayOffset(k, -1)) S.streak += 1;
    else S.streak = 1;
    S.lastLog = k;
  }

  /* ---------- 体重趋势 ---------- */
  function weightSeries(n = 30) {
    const t = todayKey();
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const k = dayOffset(t, -i);
      const d = S.days[k];
      out.push({ k, w: d && d.weight != null ? d.weight : null });
    }
    return out;
  }

  function weightAvg(n = 7) {
    const s = weightSeries(n).filter(x => x.w != null);
    if (!s.length) return null;
    return round(s.reduce((a, x) => a + x.w, 0) / s.length, 1);
  }

  /* ---------- 热量缺口 ---------- */
  function calorieBalance(k) {
    const t = calcTargets();
    const tot = dayTotals(k);
    const vol = dayVolume(k);
    // 训练消耗估算：容量 × 0.0006 ≈ 每 1000kg 容量 6kcal（保守）
    const exerciseBurn = Math.round(vol * 0.0006);
    const intake = tot.kcal;
    const deficit = t.tdee + exerciseBurn - intake;
    return { intake, burn: t.tdee + exerciseBurn, exerciseBurn, deficit };
  }

  /* ---------- 统计聚合 ---------- */
  function weekSeries(n = 7, field) {
    const t = todayKey();
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const k = dayOffset(t, -i);
      out.push({ k, v: field === 'kcal' ? dayTotals(k).kcal : dayVolume(k) });
    }
    return out;
  }

  function totalWorkouts() {
    return Object.values(S.days).reduce((a, d) => a + (d.workouts || []).length, 0);
  }

  function muscleVolume(daysBack = 7) {
    const t = todayKey();
    const acc = {};
    const EX = global.NORG_DATA.EXERCISES;
    for (let i = 0; i < daysBack; i++) {
      const k = dayOffset(t, -i);
      const d = S.days[k];
      if (!d) continue;
      (d.workouts || []).forEach(w => {
        (w.exercises || []).forEach(ex => {
          const meta = EX.find(e => e.id === ex.exId);
          if (!meta) return;
          const vol = (ex.sets || []).filter(s => s.done).reduce((a, s) => a + s.weight * s.reps, 0);
          meta.muscles.forEach(m => { acc[m] = (acc[m] || 0) + vol; });
        });
      });
    }
    return acc;
  }

  /* ---------- 主题 ---------- */
  function applyTheme(id) {
    const th = global.NORG_DATA.THEMES.find(t => t.id === id) || global.NORG_DATA.THEMES[0];
    const r = document.documentElement.style;
    r.setProperty('--red', th.accent);
    r.setProperty('--red-2', th.accent2);
    r.setProperty('--red-soft', hexA(th.accent, .14));
    r.setProperty('--bg', th.bg);
    document.querySelector('meta[name=theme-color]').setAttribute('content', th.bg);
    S.profile.theme = th.id;
    save();
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ---------- 成就 ---------- */
  function checkAchievements() {
    const got = new Set(S.achievements);
    const add = id => { if (!got.has(id)) { S.achievements.push(id); return true; } return false; };
    let n = 0;
    if (Object.values(S.days).some(d => (d.meals || []).length)) n += add('first_meal') ? 1 : 0;
    if (S.streak >= 7) n += add('week_streak') ? 1 : 0;
    if (S.streak >= 30) n += add('month_streak') ? 1 : 0;
    if (totalWorkouts() >= 1) n += add('first_workout') ? 1 : 0;
    if (totalWorkouts() >= 10) n += add('ten_workouts') ? 1 : 0;
    if (Object.keys(S.prs).length >= 5) n += add('pr_hunter') ? 1 : 0;
    if (n) save();
    return n;
  }

  /* ---------- 导出 / 导入 ---------- */
  function exportJSON() { return JSON.stringify(S, null, 2); }

  function importJSON(txt) {
    const obj = JSON.parse(txt);
    if (!obj || typeof obj !== 'object' || !obj.profile) throw new Error('格式不正确');
    S = obj;
    save();
  }

  function reset() {
    localStorage.removeItem(KEY);
    S = defaultState();
    save();
  }

  global.NorgStore = {
    load, save, get state() { return S; },
    day, dayTotals, calcTargets, addMeal, removeMeal, setWeight,
    weightSeries, weightAvg, calorieBalance, weekSeries,
    workoutVolume, workoutSets, dayVolume, totalWorkouts, muscleVolume,
    e1rm, applyTheme, checkAchievements, exportJSON, importJSON, reset,
    bumpStreak, slotOfNow,
    todayKey, dayOffset, round, clamp, uid, seed,
  };
})(window);
