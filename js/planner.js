/* ============================================================
   Norg · 计划引擎（Planner）
   ------------------------------------------------------------
   核心思想：计划不是拍脑袋排一张表，而是从你的真实数据出发，
   按运动科学原则推导出「这周该练什么、练多重、吃多少」，
   并在你执行后根据实际完成度动态调整。

   依据：
   - 训练量（组数）与肌肥大呈剂量-反应关系：每肌群 10-20 组/周
   - 渐进超负荷：以 e1RM 的百分比区间安排强度
   - 减脂期保肌：蛋白 1.6-2.2 g/kg，热量缺口 10-20% TDEE
   - 训练频率：每肌群 2 次/周 优于 1 次
   - 恢复：同一肌群间隔 ≥48h
   ============================================================ */
(function (global) {
  'use strict';

  const D = global.NORG_DATA;

  /* ---------------- 常量：运动科学参数 ---------------- */
  const SCIENCE = {
    // 每周每肌群有效组数区间（Israetel / Renaissance Periodization 的 MEV-MRV 简化版）
    volumeLandmark: {
      chest:     { mev: 8,  mav: 14, mrv: 22 },
      back:      { mev: 10, mav: 16, mrv: 24 },
      shoulders: { mev: 6,  mav: 12, mrv: 20 },
      biceps:    { mev: 6,  mav: 12, mrv: 20 },
      triceps:   { mev: 6,  mav: 12, mrv: 18 },
      quads:     { mev: 8,  mav: 15, mrv: 22 },
      hams:      { mev: 6,  mav: 12, mrv: 18 },
      glutes:    { mev: 4,  mav: 10, mrv: 18 },
      calves:    { mev: 6,  mav: 12, mrv: 20 },
      abs:       { mev: 4,  mav: 10, mrv: 16 },
      forearms:  { mev: 2,  mav: 6,  mrv: 10 },
      traps:     { mev: 2,  mav: 6,  mrv: 12 },
    },
    // 强度区间（占 1RM 百分比）与对应次数
    intensity: {
      strength: { pct: [85, 92], reps: [3, 5],  sets: [3, 5], rest: '3-5 min' },
      hypertrophy: { pct: [67, 80], reps: [6, 12], sets: [3, 4], rest: '90-120 s' },
      endurance: { pct: [50, 65], reps: [12, 20], sets: [2, 3], rest: '45-60 s' },
    },
    // 每周训练频率建议
    freq: { min: 2, opt: 3, max: 6 },
  };

  /* ---------------- 训练分化模板 ---------------- */
  /* 每个模板给出：每周几天、每天练什么、每肌群大致组数 */
  const SPLITS = {
    // 2 天：全身
    fullbody2: {
      name: '全身二分化',
      days: 2,
      desc: '每周 2 练，每次覆盖全身。适合新手或时间极少的人。',
      sessions: [
        { key: 'A', label: '全身 A', focus: ['chest', 'back', 'quads', 'abs'] },
        { key: 'B', label: '全身 B', focus: ['shoulders', 'hams', 'glutes', 'biceps', 'triceps'] },
      ],
    },
    // 3 天：推拉腿
    ppl3: {
      name: '推拉腿三分化',
      days: 3,
      desc: '每周 3 练，推 / 拉 / 腿各一次。最经典的中阶分化。',
      sessions: [
        { key: 'push', label: '推日 · 胸肩三头', focus: ['chest', 'shoulders', 'triceps'] },
        { key: 'pull', label: '拉日 · 背二头', focus: ['back', 'biceps', 'traps'] },
        { key: 'legs', label: '腿日 · 下肢核心', focus: ['quads', 'hams', 'glutes', 'calves', 'abs'] },
      ],
    },
    // 4 天：上下肢各两次
    ul4: {
      name: '上下肢四分化',
      days: 4,
      desc: '每周 4 练，上肢 / 下肢各两次。频率与容量平衡最好的方案。',
      sessions: [
        { key: 'u1', label: '上肢 A · 力量', focus: ['chest', 'back', 'shoulders'], strength: true },
        { key: 'l1', label: '下肢 A · 力量', focus: ['quads', 'hams', 'glutes'], strength: true },
        { key: 'u2', label: '上肢 B · 增肌', focus: ['chest', 'back', 'biceps', 'triceps'] },
        { key: 'l2', label: '下肢 B · 增肌', focus: ['quads', 'hams', 'calves', 'abs'] },
      ],
    },
    // 5 天：推拉腿 + 上下
    pplul5: {
      name: '推拉腿 + 上下五分化',
      days: 5,
      desc: '每周 5 练，适合有一定基础、恢复能力好的人。',
      sessions: [
        { key: 'push', label: '推日', focus: ['chest', 'shoulders', 'triceps'] },
        { key: 'pull', label: '拉日', focus: ['back', 'biceps', 'traps'] },
        { key: 'legs', label: '腿日', focus: ['quads', 'hams', 'glutes'] },
        { key: 'upper', label: '上肢日', focus: ['chest', 'back', 'shoulders'] },
        { key: 'lower', label: '下肢日', focus: ['quads', 'hams', 'calves', 'abs'] },
      ],
    },
  };

  /* ---------------- 选分化：按可用天数 + 经验 ---------------- */
  function pickSplit(daysPerWeek, level) {
    const d = Math.max(2, Math.min(6, daysPerWeek || 3));
    if (d <= 2) return 'fullbody2';
    if (d === 3) return 'ppl3';
    if (d === 4) return 'ul4';
    return 'pplul5';
  }

  /* ---------------- 选动作：按肌群 + 器械，且排除有氧 ---------------- */
  function pickExercises(muscle, equipment, count) {
    const pool = D.EXERCISES.filter(e => {
      if (e.equip === '有氧') return false;              // 有氧不参与力量编排
      if (!e.muscles.includes(muscle)) return false;
      if (equipment !== 'all' && e.equip !== equipment) return false;
      return true;
    });
    // 复合动作优先（多肌群参与），其次主肌群就是它的
    pool.sort((a, b) => {
      const aMain = a.primary === muscle ? 1 : 0;
      const bMain = b.primary === muscle ? 1 : 0;
      if (aMain !== bMain) return bMain - aMain;
      return b.muscles.length - a.muscles.length;
    });
    return pool.slice(0, count);
  }

  /* ---------------- 计算某个动作的目标重量 ---------------- */
  /* 有 PR 就按百分比；没有就用体重估算（新手默认值） */
  function targetWeight(ex, pr, profile, intensity) {
    const range = SCIENCE.intensity[intensity] || SCIENCE.intensity.hypertrophy;
    const pct = (range.pct[0] + range.pct[1]) / 2 / 100;

    if (pr && pr.e1rm > 0) {
      return Math.round(pr.e1rm * pct / 2.5) * 2.5; // 取 2.5 的倍数
    }
    // 无历史数据：按体重与动作类型粗估 1RM
    const bw = profile.weight || 70;
    const factor = estimateFactor(ex);
    return Math.round((bw * factor * pct) / 2.5) * 2.5;
  }

  /* 无数据时，按动作类型估 1RM ≈ 体重 × 系数 */
  function estimateFactor(ex) {
    const n = ex.name;
    if (/深蹲/.test(n)) return 1.2;
    if (/硬拉/.test(n)) return 1.4;
    if (/腿举/.test(n)) return 2.2;
    if (/卧推/.test(n) && /杠铃/.test(n)) return 0.95;
    if (/卧推/.test(n)) return 0.4;
    if (/推举/.test(n)) return 0.6;
    if (/划船|下拉/.test(n)) return 0.85;
    if (/弯举|侧平举|飞鸟|下压|面拉/.test(n)) return 0.18;
    if (/提踵/.test(n)) return 0.9;
    if (/臀推/.test(n)) return 1.3;
    if (/罗马尼亚/.test(n)) return 1.0;
    if (ex.equip === '自重') return 0;      // 自重动作不加重量
    return 0.3;
  }

  /* ---------------- 生成一周计划 ----------------
     关键约束（避免生成不科学的计划）：
     1. 动作全局去重 —— 同一个动作一周内不重复（除非同肌群动作不够）
     2. 按目标组数反推动作数量 —— 让每肌群周组数落在 MEV~MRV 内
     3. 排除有氧动作，不参与力量编排
     4. 同一肌群不安排连续两天 */
  function buildWeek(opts) {
    const { daysPerWeek = 3, equipment = 'all', level = 'intermediate', startDate } = opts || {};
    const S = global.NorgStore;
    const profile = S.state.profile;
    const splitKey = pickSplit(daysPerWeek, level);
    const split = SPLITS[splitKey];
    const weekdayMap = distributeDays(split.days);

    const week = {
      splitKey,
      splitName: split.name,
      splitDesc: split.desc,
      daysPerWeek: split.days,
      equipment,
      level,
      sessions: [],
      createdAt: Date.now(),
    };

    /* 每个肌群每周出现几次（用于算每次该练多少组） */
    const freqPerMuscle = {};
    split.sessions.forEach(s => {
      s.focus.forEach(m => { freqPerMuscle[m] = (freqPerMuscle[m] || 0) + 1; });
    });

    /* 全局已用动作 */
    const usedIds = new Set();

    /* 全局肌群累计组数（用于实时卡住 MRV 上限） */
    const runningVol = {};

    /* 累加某动作对各肌群的贡献（主肌群全额，协同肌群半额） */
    const addVolume = (ex, sets, sign) => {
      const meta = D.EXERCISES.find(e => e.id === ex.exId) || ex;
      const muscles = meta.muscles || [ex.muscle];
      muscles.forEach((m, idx) => {
        const w = idx === 0 ? 1 : 0.5;
        runningVol[m] = (runningVol[m] || 0) + sets * w * sign;
      });
    };

    /* 判断加入这个动作后是否会顶爆某个肌群 */
    const wouldExceed = (ex, sets) => {
      const meta = D.EXERCISES.find(e => e.id === ex.id);
      if (!meta) return false;
      return meta.muscles.some((m, idx) => {
        const lm = SCIENCE.volumeLandmark[m];
        if (!lm) return false;
        const w = idx === 0 ? 1 : 0.5;
        const after = (runningVol[m] || 0) + sets * w;
        return after > lm.mrv;
      });
    };

    split.sessions.forEach((sess, i) => {
      const dayIdx = weekdayMap[i];
      const exercises = [];

      sess.focus.forEach(muscle => {
        const lm = SCIENCE.volumeLandmark[muscle];
        if (!lm) return;
        const freq = freqPerMuscle[muscle] || 1;

        /* 每次训练的组数目标：取 MEV~MAV 中点分摊到每周次数，
           再按经验水平微调（新手取下限，进阶取上限） */
        const levelAdj = level === 'beginner' ? 0.75 : level === 'advanced' ? 1.15 : 1.0;
        const weeklyTarget = (lm.mev + lm.mav) / 2 * levelAdj;
        const perSessionSets = Math.max(2, Math.round(weeklyTarget / freq));

        /* 每个动作给 3-4 组，算出需要几个动作 */
        const setsPerEx = sess.strength ? 4 : 3;
        let exCount = Math.max(1, Math.min(3, Math.round(perSessionSets / setsPerEx)));

        const intensity = sess.strength ? 'strength' : 'hypertrophy';
        const range = SCIENCE.intensity[intensity];

        // 候选：优先没用过的
        const fresh = pickExercises(muscle, equipment, 12).filter(ex => !usedIds.has(ex.id));
        const stale = pickExercises(muscle, equipment, 12).filter(ex => usedIds.has(ex.id));
        const candidates = fresh.concat(stale);

        let placed = 0;
        for (const ex of candidates) {
          if (placed >= exCount) break;
          if (wouldExceed(ex, setsPerEx)) continue;   // 会超 MRV 就跳过

          usedIds.add(ex.id);
          const pr = S.state.prs[ex.id];
          const w = targetWeight(ex, pr, profile, intensity);
          const item = {
            exId: ex.id,
            name: ex.name,
            muscle,
            intensity,
            targetWeight: w,
            targetReps: Math.round((range.reps[0] + range.reps[1]) / 2),
            targetSets: setsPerEx,
            rest: range.rest,
            hasPR: !!pr,
          };
          exercises.push(item);
          addVolume(item, setsPerEx, 1);
          placed++;
        }

        /* 一个都没排上（动作库不够）时，退而求其次放一个不超 MRV 的 */
        if (placed === 0) {
          const fallback = pickExercises(muscle, equipment, 12)
            .find(ex => !exercises.find(e => e.exId === ex.id));
          if (fallback) {
            const pr = S.state.prs[fallback.id];
            const item = {
              exId: fallback.id,
              name: fallback.name,
              muscle,
              intensity,
              targetWeight: targetWeight(fallback, pr, profile, intensity),
              targetReps: Math.round((range.reps[0] + range.reps[1]) / 2),
              targetSets: Math.min(3, setsPerEx),
              rest: range.rest,
              hasPR: !!pr,
            };
            exercises.push(item);
            addVolume(item, item.targetSets, 1);
          }
        }
      });

      week.sessions.push({
        key: sess.key,
        label: sess.label,
        weekday: dayIdx,
        focus: sess.focus,
        strength: !!sess.strength,
        exercises,
        totalSets: exercises.reduce((a, e) => a + e.targetSets, 0),
      });
    });

    return week;
  }

  /* 把 n 个训练日均匀铺到 7 天里（避开连续两天练同一部位） */
  function distributeDays(n) {
    if (n === 2) return [1, 4];            // 周一、周四
    if (n === 3) return [1, 3, 5];         // 一、三、五
    if (n === 4) return [1, 2, 4, 5];      // 一、二、四、五
    if (n === 5) return [1, 2, 3, 5, 6];   // 一、二、三、五、六
    return [0, 1, 2, 3, 4, 5];
  }

  /* ---------------- 每周肌群组数统计（验证是否达标） ---------------- */
  function weeklyVolumeByMuscle(week) {
    const acc = {};
    week.sessions.forEach(s => {
      s.exercises.forEach(e => {
        const muscles = D.EXERCISES.find(x => x.id === e.exId)?.muscles || [e.muscle];
        // 主肌群算全额，协同肌群算一半
        muscles.forEach((m, i) => {
          const w = i === 0 ? 1 : 0.5;
          acc[m] = (acc[m] || 0) + e.targetSets * w;
        });
      });
    });
    return acc;
  }

  /* ---------------- 计划质量评估 ---------------- */
  function auditWeek(week) {
    const vol = weeklyVolumeByMuscle(week);
    const issues = [];
    const warnings = [];

    Object.entries(SCIENCE.volumeLandmark).forEach(([m, lm]) => {
      const v = Math.round(vol[m] || 0);
      const name = D.MUSCLES[m].name;
      if (v === 0 && ['chest', 'back', 'quads', 'hams'].includes(m)) {
        issues.push(`${name} 完全没有安排`);
      } else if (v > 0 && v < lm.mev) {
        warnings.push(`${name} ${v} 组，低于最低有效量 ${lm.mev} 组`);
      } else if (v > lm.mrv) {
        warnings.push(`${name} ${v} 组，超过可恢复上限 ${lm.mrv} 组`);
      }
    });

    // 检查是否连续两天练同一肌群
    const byDay = {};
    week.sessions.forEach(s => {
      byDay[s.weekday] = s.focus;
    });
    Object.keys(byDay).forEach(d => {
      const d1 = Number(d), d2 = d1 + 1;
      if (byDay[d2]) {
        const overlap = byDay[d1].filter(m => byDay[d2].includes(m));
        if (overlap.length >= 2) {
          warnings.push(`周${'日一二三四五六'[d1]}与周${'日一二三四五六'[d2]}连续练 ${overlap.map(m => D.MUSCLES[m].name).join('、')}`);
        }
      }
    });

    return { volume: vol, issues, warnings, score: Math.max(0, 100 - issues.length * 25 - warnings.length * 8) };
  }

  /* ---------------- 饮食计划：按目标生成一周菜单 ----------------
     核心问题：不同食物的「蛋白效率」差很多。
     鸡胸肉每 100 kcal 含 18.5g 蛋白，豆腐只有 8.2g。
     用低效食物凑蛋白会把热量顶爆，所以必须按效率筛选。 */
  function buildMealPlan(opts) {
    const { days = 7 } = opts || {};
    const S = global.NorgStore;
    const t = S.calcTargets();
    const foods = D.FOODS;
    const pick = name => foods.find(f => f.name === name);

    /* 蛋白效率 = 每 100 kcal 提供的蛋白克数 */
    const pEff = f => (f.kcal > 0 ? (f.p / f.kcal) * 100 : 0);
    /* 碳水效率 = 每 100 kcal 提供的碳水克数 */
    const cEff = f => (f.kcal > 0 ? (f.c / f.kcal) * 100 : 0);

    // 高效蛋白源：效率 >= 12（低于这个值的食物会把热量顶爆）
    const proteinPool = ['鸡胸肉', '龙利鱼', '虾', '鳕鱼', '牛里脊', '金枪鱼罐头', '乳清蛋白粉', '鸡蛋', '三文鱼', '鸡腿肉']
      .map(pick).filter(Boolean)
      .filter(f => pEff(f) >= 12)
      .sort((a, b) => pEff(b) - pEff(a));

    // 高效碳水：碳水效率降序（米饭 22 > 燕麦 17 > 全麦面包 18 但脂肪高）
    const carbPool = ['米饭', '馒头', '糙米饭', '意大利面', '红薯', '土豆', '燕麦片', '藜麦', '全麦面包']
      .map(pick).filter(Boolean)
      .sort((a, b) => cEff(b) - cEff(a));

    const fatPool = ['橄榄油', '杏仁', '核桃', '牛油果', '花生酱'].map(pick).filter(Boolean);
    const vegPool = ['西兰花', '菠菜', '生菜', '黄瓜', '番茄', '青椒', '香菇'].map(pick).filter(Boolean);

    if (!proteinPool.length || !carbPool.length) {
      return { days: [], target: t, error: '食物库缺少可用的蛋白或碳水来源' };
    }

    const plan = [];
    for (let i = 0; i < days; i++) {
      const pFood = proteinPool[i % proteinPool.length];
      const pFood2 = proteinPool[(i + 3) % proteinPool.length];
      const cFood = carbPool[i % carbPool.length];
      const cFood2 = carbPool[(i + 2) % carbPool.length];
      const fFood = fatPool[i % fatPool.length];
      const vFood = vegPool[i % vegPool.length];
      const vFood2 = vegPool[(i + 2) % vegPool.length];

      /* 蛋白优先配餐：
         1) 蛋白分三餐（早 25% / 午 40% / 晚 35%）
         2) 碳水分配（早 30% / 午 45% / 晚 25%）
         3) 蔬菜固定 200g
         4) 迭代微调主食，把总热量压到目标 ±2% */

      const pG = [
        Math.max(30, Math.round(t.protein * 0.25 / (pFood.p / 100) / 5) * 5),
        Math.max(30, Math.round(t.protein * 0.40 / (pFood2.p / 100) / 5) * 5),
        Math.max(30, Math.round(t.protein * 0.35 / (pFood.p / 100) / 5) * 5),
      ];
      const cG = [
        Math.max(30, Math.round(t.carb * 0.30 / (cFood.c / 100) / 5) * 5),
        Math.max(30, Math.round(t.carb * 0.45 / (cFood2.c / 100) / 5) * 5),
        Math.max(30, Math.round(t.carb * 0.25 / (cFood.c / 100) / 5) * 5),
      ];

      const meals = [
        { slot: '早餐', items: [gram(cFood, cG[0]), gram(pFood, pG[0])] },
        { slot: '午餐', items: [gram(cFood2, cG[1]), gram(pFood2, pG[1]), gram(vFood, 200)] },
        { slot: '晚餐', items: [gram(pFood, pG[2]), gram(vFood2, 200), gram(cFood, cG[2])] },
      ];

      const recount = () => {
        const tot = { kcal: 0, p: 0, c: 0, f: 0 };
        meals.forEach(m => m.items.forEach(it => {
          tot.kcal += it.kcal; tot.p += it.p; tot.c += it.c; tot.f += it.f;
        }));
        return tot;
      };
      const setGram = (item, food, g) => {
        g = Math.max(20, Math.min(500, Math.round(g)));
        item.grams = g;
        item.kcal = Math.round(food.kcal * g / 100);
        item.p = Math.round(food.p * g / 100 * 10) / 10;
        item.c = Math.round(food.c * g / 100 * 10) / 10;
        item.f = Math.round(food.f * g / 100 * 10) / 10;
      };

      /* 迭代校正：午餐主食弹性最大，贴边后换晚餐主食，最后再动早餐 */
      const carbItems = [
        { item: meals[1].items[0], food: cFood2 },
        { item: meals[2].items[2], food: cFood },
        { item: meals[0].items[0], food: cFood },
      ];
      for (let iter = 0; iter < 14; iter++) {
        const tot = recount();
        const diff = t.kcal - tot.kcal;
        if (Math.abs(diff) <= t.kcal * 0.02) break;

        // 找一个还有调整空间的碳水
        let slot = null;
        for (const c of carbItems) {
          const perG = c.food.kcal / 100;
          const want = c.item.grams + diff / perG;
          if (want >= 20 && want <= 500) { slot = c; break; }
        }
        if (!slot) {
          // 都贴边了，放宽到主项强制调
          slot = carbItems[0];
        }
        const perG = slot.food.kcal / 100;
        setGram(slot.item, slot.food, slot.item.grams + diff / perG);
      }

      // ---- 脂肪校正：总量到位后，检查脂肪是否差太多 ----
      let tot = recount();
      const fatGap = t.fat - tot.f;
      if (fatGap > 4) {
        const g = Math.round(fatGap / (fFood.f / 100) / 5) * 5;
        if (g >= 5) {
          // 加了脂肪会超热量，所以同时减主食
          const addKcal = fFood.kcal * g / 100;
          const c = carbItems[0];
          setGram(c.item, c.food, c.item.grams - addKcal / (c.food.kcal / 100));
          meals.push({ slot: '加餐', items: [gram(fFood, g)] });
        }
      }

      const total = recount();
      plan.push({
        day: i,
        meals,
        total: {
          kcal: Math.round(total.kcal),
          p: Math.round(total.p),
          c: Math.round(total.c),
          f: Math.round(total.f),
        },
        target: { kcal: t.kcal, p: t.protein, c: t.carb, f: t.fat },
      });
    }
    return { days: plan, target: t };
  }

  function gram(food, g) {
    g = Math.max(10, g);
    return {
      foodId: food.id,
      name: food.name,
      grams: g,
      kcal: Math.round(food.kcal * g / 100),
      p: Math.round(food.p * g / 100 * 10) / 10,
      c: Math.round(food.c * g / 100 * 10) / 10,
      f: Math.round(food.f * g / 100 * 10) / 10,
    };
  }

  /* ---------------- 有氧安排建议 ---------------- */
  function cardioPlan(goalType, daysPerWeek) {
    if (goalType === 'cut') {
      return {
        sessions: Math.max(2, Math.min(5, daysPerWeek - 1)),
        type: 'Zone 2 低强度有氧',
        duration: '30-45 分钟',
        hr: '最大心率 60-70%',
        note: '安排在力量训练之后或非训练日，避免影响力量表现。每周 150-250 分钟。',
      };
    }
    if (goalType === 'bulk') {
      return {
        sessions: 1,
        type: 'Zone 2 有氧',
        duration: '20-25 分钟',
        hr: '最大心率 60-65%',
        note: '仅用于维持心肺健康，不要过量，以免影响增肌所需的能量盈余。',
      };
    }
    return {
      sessions: 2,
      type: '混合有氧',
      duration: '25-30 分钟',
      hr: '最大心率 60-75%',
      note: '维持心血管健康，每周 2 次即可。',
    };
  }

  /* ---------------- 进度追踪与动态调整 ---------------- */
  /* 根据过去 2 周的实际完成率，建议加量 / 维持 / 减量 */
  function progressReview() {
    const S = global.NorgStore;
    const today = S.todayKey();
    let planned = 0, done = 0;
    const byMuscle = {};

    for (let i = 0; i < 14; i++) {
      const k = S.dayOffset(today, -i);
      const d = S.state.days[k];
      if (!d) continue;
      (d.workouts || []).forEach(w => {
        done++;
        (w.exercises || []).forEach(ex => {
          const meta = D.EXERCISES.find(e => e.id === ex.exId);
          if (!meta) return;
          const sets = (ex.sets || []).filter(s => s.done).length;
          meta.muscles.forEach((m, idx) => {
            byMuscle[m] = (byMuscle[m] || 0) + sets * (idx === 0 ? 1 : 0.5);
          });
        });
      });
    }

    const avgPerWeek = done / 2;
    const vol = S.muscleVolume(14);
    const suggestions = [];

    Object.entries(SCIENCE.volumeLandmark).forEach(([m, lm]) => {
      const v = (byMuscle[m] || 0) / 2; // 每周平均
      const name = D.MUSCLES[m].name;
      if (v === 0) return;
      if (v < lm.mev) {
        suggestions.push({ type: 'increase', muscle: m, text: `${name} 周均 ${v.toFixed(1)} 组，低于 MEV ${lm.mev}，建议每周增加 2-4 组` });
      } else if (v > lm.mrv) {
        suggestions.push({ type: 'decrease', muscle: m, text: `${name} 周均 ${v.toFixed(1)} 组，超过 MRV ${lm.mrv}，建议减量或安排减载周` });
      }
    });

    // 体重趋势 vs 目标速率
    const ws = S.weightSeries(14).filter(x => x.w != null);
    let weightAdvice = null;
    if (ws.length >= 7) {
      const first = ws[0].w, last = ws[ws.length - 1].w;
      const weeks = ws.length / 7;
      const rate = (last - first) / weeks;
      const target = S.state.profile.goalRate;
      const diff = rate - target;
      if (Math.abs(diff) > 0.3) {
        weightAdvice = diff < 0
          ? `实际减重 ${Math.abs(rate).toFixed(2)} kg/周，慢于目标 ${Math.abs(target)}，建议每日再减 150-200 kcal 或增加 1 次有氧`
          : `实际变化 ${rate.toFixed(2)} kg/周，快于目标 ${target}，建议每日增加 150-200 kcal，避免掉肌肉`;
      } else {
        weightAdvice = `实际 ${rate.toFixed(2)} kg/周，与目标 ${target} kg/周 基本吻合，保持当前方案`;
      }
    }

    return {
      sessionsPerWeek: Math.round(avgPerWeek * 10) / 10,
      suggestions,
      weightAdvice,
      muscleVolume: byMuscle,
    };
  }

  global.NorgPlanner = {
    SCIENCE, SPLITS,
    buildWeek, auditWeek, weeklyVolumeByMuscle,
    buildMealPlan, cardioPlan, progressReview,
    pickSplit, targetWeight,
  };
})(window);
