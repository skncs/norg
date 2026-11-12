/* ============================================================
   Norg · 应用控制器
   路由 / 事件委托 / 各类弹层流程
   ============================================================ */
(function (global) {
  'use strict';

  const S = global.NorgStore;
  const C = global.NorgChart;
  const U = global.NorgUI;
  const D = global.NORG_DATA;
  const VW = global.NorgViews;
  const V = VW.V;
  const esc = U.esc, ICON = U.ICON;
  const $ = U.$, $$ = U.$$;

  /* ==========================================================
     3D 视图管理（页面级）
     ========================================================== */
  let pageViewer = null;
  function disposePageViewer() {
    if (pageViewer) { try { pageViewer.dispose(); } catch (e) {} pageViewer = null; }
  }

  function initPage3d(tab) {
    disposePageViewer();
    if (tab !== 'train') return;
    const el = document.getElementById('train3d');
    if (!el) return;

    global.Norg3D.ensureThree().then(() => {
      if (!document.getElementById('train3d')) return;
      try {
        pageViewer = global.Norg3D.createViewer(el, { height: 340, autoRotate: true });
        pageViewer.setAnim('idle');
        pageViewer.setView('front');
        pageViewer.heatmap(S.muscleVolume(7));
      } catch (e) {
        el.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:var(--t4);font-size:12px">3D 加载失败</div>`;
      }
    }).catch(() => {
      el.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:var(--t4);font-size:12px">3D 加载失败</div>`;
    });
  }

  /* ==========================================================
     渲染
     ========================================================== */
  function render() {
    const tab = VW.tab;
    const el = $('#view');
    const PV = global.NorgPlanViews;

    // 计划相关子页
    if (tab === 'plan') {
      const sub = VW.planSub;
      if (sub && sub.type === 'session') el.innerHTML = PV.V.planSession(sub.key);
      else if (sub && sub.type === 'meal') el.innerHTML = PV.V.planMeal();
      else el.innerHTML = PV.V.plan();
    } else {
      el.innerHTML = V[tab] ? V[tab]() : '';
    }

    el.scrollTop = 0;
    window.scrollTo(0, 0);
    $$('.tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === tab));
    $('#streakNum').textContent = S.state.streak || 0;

    // FAB
    const old = $('#fab');
    if (old) old.remove();
    if (tab === 'diet' || tab === 'train') {
      const f = document.createElement('button');
      f.id = 'fab';
      f.className = 'fab';
      f.innerHTML = ICON.plus;
      f.onclick = () => tab === 'diet' ? openAddMeal() : openAddWorkout();
      document.body.appendChild(f);
    }

    // 训练页的 3D 肌群图
    setTimeout(() => initPage3d(tab), 30);
  }

  /* ==========================================================
     事件委托
     ========================================================== */
  function bindGlobal() {
    $('#tabbar').addEventListener('click', e => {
      const b = e.target.closest('.tab');
      if (!b) return;
      VW.tab = b.dataset.tab;
      VW.planSub = null;
      render();
    });

    $('#view').addEventListener('click', e => {
      const t = e.target;

      // 删除一餐
      const del = t.closest('[data-del]');
      if (del) {
        e.stopPropagation();
        const k = VW.viewDate || S.todayKey();
        S.removeMeal(k, del.dataset.del);
        U.toast('已删除');
        render();
        return;
      }

      // 计划：打开某个训练日
      const ps = t.closest('[data-session]');
      if (ps) {
        VW.planSub = { type: 'session', key: ps.dataset.session };
        render();
        return;
      }

      // 计划：动作详情
      const pex = t.closest('[data-planex]');
      if (pex) { openExercise(pex.dataset.planex); return; }

      // 打开某个动作
      const ex = t.closest('[data-ex]');
      if (ex) { openExercise(ex.dataset.ex); return; }

      // 打开某次训练
      const wk = t.closest('[data-workout]');
      if (wk) { openWorkoutDetail(wk.dataset.workout); return; }

      // 指定餐次添加
      const as = t.closest('[data-addslot]');
      if (as) { openAddMeal(as.dataset.addslot); return; }

      // 快捷添加
      const qk = t.closest('[data-quick]');
      if (qk) {
        const f = D.FOODS.find(x => x.id === qk.dataset.quick);
        if (f) { S.addMeal(S.todayKey(), f, f.serving); U.toast(`已添加 ${f.name} ${f.serving}g`); render(); }
        return;
      }

      // 模式切换
      const md = t.closest('[data-mode]');
      if (md) { VW.mode = md.dataset.mode; render(); return; }

      // 通用动作
      const act = t.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      switch (a) {
        case 'addMeal': openAddMeal(); break;
        case 'addWorkout': openAddWorkout(); break;
        case 'editweight': openWeight(); break;
        case 'prevday': VW.viewDate = S.dayOffset(VW.viewDate || S.todayKey(), -1); render(); break;
        case 'nextday': {
          const n = S.dayOffset(VW.viewDate || S.todayKey(), 1);
          VW.viewDate = n > S.todayKey() ? S.todayKey() : n;
          render();
          break;
        }
        case 'goDiet': VW.tab = 'diet'; render(); break;
        case 'settings': openSettings(); break;
        case 'themes': openThemes(); break;
        case 'achv': openAchievements(); break;
        case 'pr': openPRs(); break;
        case 'college': U.toast('Norg 学院 · 内容持续更新中'); break;
        case 'plan': openPlan(); break;
        case 'rank': openRank(); break;
        case 'allEx': openAllExercises(); break;
        case 'export': doExport(); break;
        case 'import': doImport(); break;
        case 'reset': doReset(); break;

        // ===== 计划相关 =====
        case 'backPlan': VW.planSub = null; render(); break;
        case 'mealPlan': VW.planSub = { type: 'meal' }; render(); break;
        case 'planSettings': openPlanSettings(); break;
        case 'startFromPlan': {
          const PV = global.NorgPlanViews;
          const week = PV.getWeek();
          const today = week.sessions.find(s => s.weekday === new Date().getDay());
          if (today) startSessionFromPlan(today);
          else U.toast('今天没有安排训练');
          break;
        }
        case 'startSession': startSessionFromPlanByKey(act.dataset.key); break;
      }
    });

    $('#btnPro').onclick = () => U.toast('PRO 已解锁（演示版全部功能免费）');
    $('#btnStreak').onclick = () => U.toast(`已连续记录 ${S.state.streak} 天`);
    $('#sheetClose').onclick = U.closeSheet;
    $('#sheetMask').onclick = U.closeSheet;
  }

  /* ==========================================================
     按计划开始训练
     ========================================================== */
  function startSessionFromPlanByKey(key) {
    const PV = global.NorgPlanViews;
    const week = PV.getWeek();
    const s = week.sessions.find(x => x.key === key);
    if (s) startSessionFromPlan(s);
  }

  function startSessionFromPlan(session) {
    const k = S.todayKey();
    const d = S.day(k);

    // 已存在同名训练就复用，避免重复创建
    let w = d.workouts.find(x => x.name === session.label);
    if (!w) {
      w = {
        id: S.uid(),
        name: session.label,
        ts: Date.now(),
        dur: Math.round(session.totalSets * 3),
        exercises: session.exercises.map(e => ({
          exId: e.exId,
          name: e.name,
          sets: [],
          // 计划的目标值，供记录时预填
          planned: { weight: e.targetWeight, reps: e.targetReps, sets: e.targetSets },
        })),
      };
      d.workouts.push(w);
      S.save();
      U.toast('已按计划创建训练');
    } else {
      U.toast('今天的这个训练已存在');
    }

    VW.tab = 'train';
    VW.planSub = null;
    render();
    setTimeout(() => openWorkoutDetail(w.id), 240);
  }

  /* ==========================================================
     计划设置
     ========================================================== */
  function openPlanSettings() {
    const p = S.state.profile;
    const PV = global.NorgPlanViews;
    const week = PV.getWeek();

    const html = `
      <div class="field">
        <label>每周能练几天</label>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${[2, 3, 4, 5].map(n => `<button class="tag ${p.daysPerWeek == n ? 'red' : ''}" data-days="${n}">${n} 天</button>`).join('')}
        </div>
      </div>

      <div class="field" style="margin-top:14px">
        <label>可用器械</label>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${[['all', '不限'], ['杠铃', '杠铃'], ['哑铃', '哑铃'], ['器械', '固定器械'], ['绳索', '绳索'], ['自重', '自重']]
            .map(([v, t]) => `<button class="tag ${p.equipment === v ? 'red' : ''}" data-eq="${v}">${t}</button>`).join('')}
        </div>
      </div>

      <div class="field" style="margin-top:14px">
        <label>训练经验</label>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${[['beginner', '新手（<1年）'], ['intermediate', '中阶（1-3年）'], ['advanced', '进阶（3年+）']]
            .map(([v, t]) => `<button class="tag ${p.level === v ? 'red' : ''}" data-lv="${v}">${t}</button>`).join('')}
        </div>
      </div>

      <div class="card" style="margin:16px 0">
        <div class="tiny muted" style="font-weight:700;margin-bottom:7px">当前方案</div>
        <div style="font-size:14.5px;font-weight:800">${esc(week.splitName)}</div>
        <div class="tiny muted" style="margin-top:5px;line-height:1.55">${esc(week.splitDesc)}</div>
      </div>

      <button class="btn" id="regenPlan">重新生成计划</button>
      <div class="tiny muted center" style="margin-top:10px;line-height:1.6">
        重新生成会按新的天数 / 器械 / 经验重新编排动作和目标重量。<br>已记录的训练数据不受影响。
      </div>
    `;

    U.openSheet('计划设置', html, {
      after: () => {
        let days = p.daysPerWeek, eq = p.equipment, lv = p.level;
        $('#sheetBody').addEventListener('click', e => {
          const d1 = e.target.closest('[data-days]');
          if (d1) {
            days = Number(d1.dataset.days);
            $$('[data-days]').forEach(b => b.classList.toggle('red', b.dataset.days == days));
            return;
          }
          const e1 = e.target.closest('[data-eq]');
          if (e1) {
            eq = e1.dataset.eq;
            $$('[data-eq]').forEach(b => b.classList.toggle('red', b.dataset.eq === eq));
            return;
          }
          const l1 = e.target.closest('[data-lv]');
          if (l1) {
            lv = l1.dataset.lv;
            $$('[data-lv]').forEach(b => b.classList.toggle('red', b.dataset.lv === lv));
            return;
          }
          if (e.target.closest('#regenPlan')) {
            p.daysPerWeek = days;
            p.equipment = eq;
            p.level = lv;
            S.save();
            PV.regenWeek({ daysPerWeek: days, equipment: eq, level: lv });
            U.closeSheet();
            U.toast('计划已重新生成');
            render();
          }
        });
      },
    });
  }

  /* ==========================================================
     记录饮食
     ========================================================== */
  let mealPick = { slot: null, food: null, grams: 100, cat: '全部', q: '' };

  function openAddMeal(slot) {
    mealPick = { slot: slot || null, food: null, grams: 100, cat: '全部', q: '' };
    U.openSheet('记录饮食', mealSheetHTML(), { after: bindMealSheet });
  }

  function mealSheetHTML() {
    const cats = ['全部', '主食', '蛋白', '乳制品', '蔬菜', '水果', '油脂', '外食', '饮品'];
    const q = mealPick.q.trim();
    let list = D.FOODS;
    if (mealPick.cat !== '全部') list = list.filter(f => f.cat === mealPick.cat);
    if (q) list = list.filter(f => (f.name + ' ' + f.alias).toLowerCase().includes(q.toLowerCase()));
    list = list.slice(0, 60);

    return `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <div style="flex:1;position:relative">
          <span style="position:absolute;left:13px;top:14px;width:18px;height:18px;color:var(--t4)">${ICON.search}</span>
          <input class="input" id="fq" placeholder="搜索食物，如 鸡胸肉" value="${esc(mealPick.q)}" style="padding-left:38px" />
        </div>
      </div>
      <div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:10px;margin-bottom:6px">
        ${cats.map(c => `<button class="tag ${mealPick.cat === c ? 'red' : ''}" data-cat="${c}" style="white-space:nowrap">${c}</button>`).join('')}
      </div>
      <div id="flist" style="max-height:44vh;overflow-y:auto;margin:0 -4px">
        ${list.map(f => `
          <div class="row" data-food="${f.id}" style="margin:0 4px 7px">
            <div class="mid">
              <div class="t">${esc(f.name)}</div>
              <div class="s">每100g · P${f.p} C${f.c} F${f.f}</div>
            </div>
            <div class="r"><div class="n">${f.kcal}</div><div class="u">kcal</div></div>
          </div>`).join('') || `<div class="empty">没有找到相关食物</div>`}
      </div>`;
  }

  function bindMealSheet() {
    const q = $('#fq');
    if (q) {
      q.addEventListener('input', () => {
        mealPick.q = q.value;
        $('#flist').innerHTML = renderFoodList();
      });
      q.addEventListener('focus', () => setTimeout(() => q.setSelectionRange(q.value.length, q.value.length), 10));
    }
    $('#sheetBody').addEventListener('click', e => {
      const cat = e.target.closest('[data-cat]');
      if (cat) {
        mealPick.cat = cat.dataset.cat;
        U.openSheet('记录饮食', mealSheetHTML(), { after: bindMealSheet });
        return;
      }
      const fi = e.target.closest('[data-food]');
      if (fi) {
        mealPick.food = D.FOODS.find(f => f.id === fi.dataset.food);
        mealPick.grams = mealPick.food.serving;
        openGramsSheet();
      }
    });
  }

  function renderFoodList() {
    let list = D.FOODS;
    if (mealPick.cat !== '全部') list = list.filter(f => f.cat === mealPick.cat);
    if (mealPick.q.trim()) {
      const q = mealPick.q.trim().toLowerCase();
      list = list.filter(f => (f.name + ' ' + f.alias).toLowerCase().includes(q));
    }
    list = list.slice(0, 60);
    return list.map(f => `
      <div class="row" data-food="${f.id}" style="margin:0 4px 7px">
        <div class="mid"><div class="t">${esc(f.name)}</div>
          <div class="s">每100g · P${f.p} C${f.c} F${f.f}</div></div>
        <div class="r"><div class="n">${f.kcal}</div><div class="u">kcal</div></div>
      </div>`).join('') || `<div class="empty">没有找到相关食物</div>`;
  }

  function openGramsSheet() {
    const f = mealPick.food;
    const slots = ['早餐', '午餐', '晚餐', '加餐'];
    if (!mealPick.slot) mealPick.slot = S.slotOfNow ? S.slotOfNow() : '午餐';

    const html = `
      <div style="display:flex;align-items:center;gap:13px;margin-bottom:16px">
        <div class="ico" style="width:50px;height:50px;border-radius:16px;display:grid;place-items:center;font-size:23px;background:rgba(255,59,48,.14);border:1px solid rgba(255,59,48,.28)">🍽️</div>
        <div>
          <div style="font-size:17px;font-weight:800">${esc(f.name)}</div>
          <div class="tiny muted" style="margin-top:3px">每 100g：${f.kcal} kcal · P${f.p} C${f.c} F${f.f}</div>
        </div>
      </div>

      <div class="field">
        <label>份量（克）</label>
        <input class="input" id="gIn" type="number" inputmode="decimal" value="${mealPick.grams}" />
      </div>
      <div style="display:flex;gap:7px;margin-bottom:14px;flex-wrap:wrap">
        ${[50, 100, 150, 200, 250, 300].map(g => `<button class="tag" data-g="${g}">${g}g</button>`).join('')}
        <button class="tag red" data-g="${f.serving}">1份 ${f.serving}g</button>
      </div>

      <div class="field">
        <label>餐次</label>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${slots.map(s => `<button class="tag ${mealPick.slot === s ? 'red' : ''}" data-slot="${s}">${s}</button>`).join('')}
        </div>
      </div>

      <div class="card" style="margin:16px 0" id="preview">
        ${previewHTML(f, mealPick.grams)}
      </div>

      <button class="btn" id="doAdd">加入记录</button>
    `;
    U.openSheet('添加食物', html, {
      after: () => {
        const gIn = $('#gIn');
        const upd = () => {
          mealPick.grams = Number(gIn.value) || 0;
          $('#preview').innerHTML = previewHTML(f, mealPick.grams);
        };
        gIn.addEventListener('input', upd);
        $('#sheetBody').addEventListener('click', e => {
          const g = e.target.closest('[data-g]');
          if (g) { gIn.value = g.dataset.g; upd(); return; }
          const s = e.target.closest('[data-slot]');
          if (s) {
            mealPick.slot = s.dataset.slot;
            $$('[data-slot]').forEach(b => b.classList.toggle('red', b.dataset.slot === mealPick.slot));
            return;
          }
          if (e.target.closest('#doAdd')) {
            if (!mealPick.grams) { U.toast('请输入份量'); return; }
            S.addMeal(S.todayKey(), f, mealPick.grams, mealPick.slot);
            U.closeSheet();
            U.toast(`已记录 ${f.name} ${mealPick.grams}g`);
            render();
          }
        });
      },
    });
  }

  function previewHTML(f, g) {
    const k = Math.round(f.kcal * g / 100);
    const p = Math.round(f.p * g / 100 * 10) / 10;
    const c = Math.round(f.c * g / 100 * 10) / 10;
    const fa = Math.round(f.f * g / 100 * 10) / 10;
    return `<div style="display:flex;align-items:center">
      <div>
        <div class="tiny muted" style="font-weight:700">本次摄入</div>
        <div style="font-size:28px;font-weight:800;letter-spacing:-1.2px;line-height:1.2">${k}<span style="font-size:12px;color:var(--t3)"> kcal</span></div>
      </div>
      <div style="margin-left:auto;display:flex;gap:14px;text-align:right">
        <div><div class="tiny muted">蛋白</div><div style="font-size:15px;font-weight:800;color:var(--purple)">${p}g</div></div>
        <div><div class="tiny muted">碳水</div><div style="font-size:15px;font-weight:800;color:var(--green)">${c}g</div></div>
        <div><div class="tiny muted">脂肪</div><div style="font-size:15px;font-weight:800;color:var(--yellow)">${fa}g</div></div>
      </div>
    </div>`;
  }

  /* ==========================================================
     记录体重
     ========================================================== */
  function openWeight() {
    const k = VW.viewDate || S.todayKey();
    const d = S.day(k);
    const cur = d.weight != null ? d.weight : S.state.profile.weight;
    const html = `
      <div class="field">
        <label>体重（kg）</label>
        <input class="input" id="wIn" type="number" inputmode="decimal" step="0.1" value="${cur}" style="font-size:26px;height:60px;font-weight:800;text-align:center" />
      </div>
      <div style="display:flex;gap:7px;margin-bottom:16px;justify-content:center">
        ${[-0.5, -0.1, +0.1, +0.5].map(x => `<button class="tag" data-adj="${x}">${x > 0 ? '+' : ''}${x}</button>`).join('')}
      </div>
      <div class="card" style="margin-bottom:16px">
        ${C.line({ w: 280, h: 80, points: S.weightSeries(14) })}
        <div class="tiny muted center" style="margin-top:6px">近 14 天趋势</div>
      </div>
      <button class="btn" id="doW">保存体重</button>
    `;
    U.openSheet('记录体重', html, {
      after: () => {
        const inp = $('#wIn');
        $('#sheetBody').addEventListener('click', e => {
          const adj = e.target.closest('[data-adj]');
          if (adj) { inp.value = (Number(inp.value) + Number(adj.dataset.adj)).toFixed(1); return; }
          if (e.target.closest('#doW')) {
            const v = Number(inp.value);
            if (!v || v < 20 || v > 300) { U.toast('请输入合理体重'); return; }
            S.setWeight(k, v);
            U.closeSheet();
            U.toast('体重已记录');
            render();
          }
        });
      },
    });
  }

  /* ==========================================================
     动作详情
     ========================================================== */
  function openExercise(id) {
    const ex = D.EXERCISES.find(e => e.id === id);
    if (!ex) return;
    let tab = 'about';
    const pr = S.state.prs[id];

    const build = () => {
      const m = D.MUSCLES[ex.primary];
      let body = '';
      if (tab === 'about') {
        body = `
          <div id="ex3dWrap" style="border-radius:var(--r-l);overflow:hidden;position:relative;
               background:radial-gradient(75% 75% at 50% 28%, #1e2430 0%, #0a0c10 78%);
               aspect-ratio:1.28/1;margin-bottom:8px">
            <div id="ex3d" style="width:100%;height:100%"></div>
            <div id="ex3dFallback" style="position:absolute;inset:0;display:none;place-items:center;
                 background:linear-gradient(160deg,#f2f2f0,#d4d4d0)">
              ${C.exerciseArt(ex)}
            </div>
            <div style="position:absolute;top:10px;right:10px;display:flex;gap:5px;z-index:2">
              <button class="tag" id="btn3dToggle" style="background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.16);font-size:10.5px">暂停</button>
            </div>
            <div style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);
                 display:flex;gap:5px;z-index:2">
              <button class="tag" data-view="front" style="background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.16);font-size:10.5px">正面</button>
              <button class="tag" data-view="q34" style="background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.16);font-size:10.5px">斜侧</button>
              <button class="tag" data-view="side" style="background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.16);font-size:10.5px">侧面</button>
              <button class="tag" data-view="back" style="background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.16);font-size:10.5px">背面</button>
            </div>
          </div>
          <div class="tiny muted" style="margin-bottom:12px;display:flex;align-items:center;gap:6px">
            <span style="width:5px;height:5px;border-radius:50%;background:var(--red);box-shadow:0 0 6px var(--red)"></span>
            3D 解剖示范 · 可拖动旋转
          </div>
          <div style="font-size:13.5px;line-height:1.75;color:var(--t2)">${esc(ex.desc)}</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px">
            <div class="card" style="padding:12px">
              <div class="tiny muted" style="font-weight:700">主要肌群</div>
              <div style="font-size:15px;font-weight:800;margin-top:4px">${m.name}</div>
            </div>
            <div class="card" style="padding:12px">
              <div class="tiny muted" style="font-weight:700">器械</div>
              <div style="font-size:15px;font-weight:800;margin-top:4px">${esc(ex.equip)}</div>
            </div>
          </div>
          <div class="sec-title" style="margin:18px 2px 10px"><span class="dot"></span>目标肌群</div>
          <div id="exMuscle3d" style="border-radius:var(--r-l);overflow:hidden;
               background:radial-gradient(70% 70% at 50% 25%, #1e2430, #0a0c10 75%);
               border:1px solid var(--line);height:300px"></div>
          <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:7px">
            ${ex.muscles.map(k => `<span class="tag"><i style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${D.MUSCLES[k].color};margin-right:5px"></i>${D.MUSCLES[k].name}</span>`).join('')}
          </div>
          <div class="sec-title" style="margin:18px 2px 10px"><span class="dot"></span>动作要领</div>
          <div style="display:flex;flex-direction:column;gap:9px">
            ${ex.steps.map((s, i) => `<div style="display:flex;gap:10px;font-size:13px;line-height:1.6;color:var(--t2)">
              <span style="flex:0 0 auto;width:20px;height:20px;border-radius:50%;background:rgba(255,59,48,.16);color:#ff8b82;font-size:11px;font-weight:800;display:grid;place-items:center">${i + 1}</span>
              <span>${esc(s)}</span></div>`).join('')}
          </div>
          ${ex.tips.length ? `
            <div class="sec-title" style="margin:18px 2px 10px"><span class="dot"></span>教练提示</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${ex.tips.map(t => `<div style="display:flex;gap:9px;font-size:12.5px;line-height:1.6;color:var(--t3)">
                <span style="color:var(--orange)">▸</span><span>${esc(t)}</span></div>`).join('')}
            </div>` : ''}
        `;
      } else if (tab === 'history') {
        const hist = [];
        Object.entries(S.state.days).forEach(([dk, dd]) => {
          (dd.workouts || []).forEach(w => {
            (w.exercises || []).forEach(e2 => {
              if (e2.exId === id) hist.push({ dk, sets: e2.sets });
            });
          });
        });
        hist.sort((a, b) => b.dk.localeCompare(a.dk));
        body = hist.length ? hist.map(h => `
          <div class="card" style="margin-bottom:10px;padding:13px 15px">
            <div style="display:flex;font-size:12.5px;font-weight:800;margin-bottom:8px">
              <span>${h.dk}</span>
              <span class="muted" style="margin-left:auto;font-weight:600">${h.sets.filter(s => s.done).length} 组 · ${Math.round(h.sets.reduce((a, s) => a + s.weight * s.reps, 0))} kg</span>
            </div>
            ${h.sets.map((s, i) => `<div class="set-line">
              <span class="idx">${i + 1}</span>
              <span class="v">${s.weight}<span class="u"> kg</span></span>
              <span class="v">${s.reps}<span class="u"> 次</span></span>
              <span class="muted">${S.e1rm(s.weight, s.reps)}<span class="u"> 1RM</span></span>
              <span></span>
            </div>`).join('')}
          </div>`).join('') : `<div class="empty">还没有该动作的历史记录</div>`;
      } else if (tab === 'progress') {
        const pts = [];
        Object.entries(S.state.days).forEach(([dk, dd]) => {
          (dd.workouts || []).forEach(w => {
            (w.exercises || []).forEach(e2 => {
              if (e2.exId === id) {
                const best = Math.max(...e2.sets.filter(s => s.done).map(s => S.e1rm(s.weight, s.reps)), 0);
                if (best) pts.push({ k: dk, v: best });
              }
            });
          });
        });
        pts.sort((a, b) => a.k.localeCompare(b.k));
        body = pts.length > 1 ? `
          <div class="card">
            <div style="font-size:12px;font-weight:700;color:var(--t3);margin-bottom:10px">估算 1RM 变化</div>
            ${C.line({ w: 280, h: 110, points: pts.map(p => ({ w: p.v })), minPad: 2 })}
            <div style="display:flex;justify-content:space-between;margin-top:8px" class="tiny muted">
              <span>${pts[0].k}</span><span>${pts[pts.length - 1].k}</span>
            </div>
          </div>
          <div class="grid2" style="margin-top:11px">
            <div class="mini"><div class="h"><span>起始</span></div><div class="big">${pts[0].v}<span>kg</span></div></div>
            <div class="mini"><div class="h"><span>当前</span></div><div class="big">${pts[pts.length - 1].v}<span>kg</span></div></div>
          </div>` : `<div class="empty">数据不足，再练几次就能看到进步曲线</div>`;
      } else {
        body = `
          <div class="card" style="margin-bottom:12px">
            <div class="tiny muted" style="font-weight:700">个人最佳</div>
            <div style="font-size:34px;font-weight:800;letter-spacing:-1.4px;line-height:1.2">${pr ? pr.e1rm : '--'}<span style="font-size:13px;color:var(--t3)"> kg 估算1RM</span></div>
            <div class="tiny muted" style="margin-top:5px">${pr ? `${pr.weight}kg × ${pr.reps} · ${pr.date}` : '还没有纪录'}</div>
          </div>
          <div class="card">
            <div style="font-size:12px;font-weight:700;color:var(--t3);margin-bottom:10px">1RM 换算表（Epley）</div>
            ${[1, 2, 3, 5, 6, 8, 10, 12, 15].map(r => {
              const base = pr ? pr.e1rm : 0;
              const w = base ? S.round(base / (1 + r / 30), 1) : 0;
              return `<div class="set-line" style="grid-template-columns:1fr 1fr 1fr">
                <span class="muted">${r} RM</span>
                <span class="v">${w || '--'}<span class="u"> kg</span></span>
                <span class="muted tiny">${['力量', '力量', '力量', '', '增肌', '增肌', '增肌', '耐力', '耐力'][r - 1] || ''}</span>
              </div>`;
            }).join('')}
          </div>`;
      }

      return `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
          <span class="tag red">${D.MUSCLES[ex.primary].name}</span>
          <span class="tag">${esc(ex.equip)}</span>
        </div>
        <div class="seg" style="margin-top:12px;margin-bottom:14px">
          <button class="${tab === 'about' ? 'on' : ''}" data-etab="about">关于</button>
          <button class="${tab === 'history' ? 'on' : ''}" data-etab="history">历史记录</button>
          <button class="${tab === 'progress' ? 'on' : ''}" data-etab="progress">进度</button>
          <button class="${tab === 'record' ? 'on' : ''}" data-etab="record">纪录</button>
        </div>
        ${body}
        <button class="btn" style="margin-top:18px" id="logThis">记录这组训练</button>
      `;
    };

    /* 3D 场景实例（切换 tab 时销毁重建，避免泄漏） */
    let viewer3d = null;
    let muscleViewer = null;

    const dispose3d = () => {
      if (viewer3d) { try { viewer3d.dispose(); } catch (e) {} viewer3d = null; }
      if (muscleViewer) { try { muscleViewer.dispose(); } catch (e) {} muscleViewer = null; }
    };

    const init3d = () => {
      if (tab !== 'about') return;
      const wrap = document.getElementById('ex3d');
      if (!wrap) return;

      global.Norg3D.ensureThree().then(() => {
        // 弹层可能在异步期间被关掉
        if (!document.getElementById('ex3d')) return;

        /* ---- 动作动画视图 ---- */
        try {
          viewer3d = global.Norg3D.createViewer(wrap, { height: wrap.clientHeight || 240 });
          const animKey = global.Norg3D.pickAnim(ex.name);
          viewer3d.setAnim(animKey);
          // 主肌群亮（红心蓝边）
          viewer3d.highlight(ex.muscles.slice(0, 2));
        } catch (e) {
          const fb = document.getElementById('ex3dFallback');
          if (fb) fb.style.display = 'grid';
          console.warn('3D 动作视图初始化失败', e);
        }

        /* ---- 目标肌群静态视图 ---- */
        const mw = document.getElementById('exMuscle3d');
        if (mw) {
          try {
            muscleViewer = global.Norg3D.createViewer(mw, { height: 300, autoRotate: true });
            muscleViewer.setAnim('idle');
            muscleViewer.setView('front');
            // 主肌群亮，协同肌群稍暗
            const heat = {};
            ex.muscles.forEach((k, i) => { heat[k] = ex.muscles.length - i; });
            muscleViewer.heatmap(heat);
          } catch (e) {
            mw.innerHTML = `<div style="display:grid;place-items:center;height:100%;color:var(--t4);font-size:12px">3D 加载失败</div>`;
          }
        }
      }).catch(() => {
        const fb = document.getElementById('ex3dFallback');
        if (fb) fb.style.display = 'grid';
      });
    };

    const rerender = () => {
      dispose3d();
      U.openSheet(ex.name, build(), { after: rerender });
      setTimeout(init3d, 60);
    };

    U.openSheet(ex.name, build(), {
      after: () => {
        $('#sheetBody').addEventListener('click', e => {
          const tb = e.target.closest('[data-etab]');
          if (tb) {
            tab = tb.dataset.etab;
            rerender();
            return;
          }
          // 3D 控制
          if (e.target.closest('#btn3dToggle')) {
            const btn = e.target.closest('#btn3dToggle');
            const paused = btn.dataset.paused === '1';
            if (viewer3d) viewer3d.setPlaying(paused);
            btn.dataset.paused = paused ? '0' : '1';
            btn.textContent = paused ? '暂停' : '播放';
            return;
          }
          const vb = e.target.closest('[data-view]');
          if (vb) {
            if (viewer3d) viewer3d.setView(vb.dataset.view);
            $$('[data-view]').forEach(b => {
              b.style.background = b === vb ? 'rgba(255,59,48,.85)' : 'rgba(0,0,0,.55)';
            });
            return;
          }
          if (e.target.closest('#logThis')) openQuickLog(ex);
        });
        setTimeout(init3d, 80);
      },
      onClose: dispose3d,
    });
  }

  /* ---------- 快速记一组 ---------- */
  function openQuickLog(ex) {
    const last = (() => {
      const arr = [];
      Object.entries(S.state.days).forEach(([dk, dd]) => {
        (dd.workouts || []).forEach(w => (w.exercises || []).forEach(e2 => {
          if (e2.exId === ex.id) arr.push({ dk, sets: e2.sets });
        }));
      });
      arr.sort((a, b) => b.dk.localeCompare(a.dk));
      return arr[0];
    })();
    const lastSet = last && last.sets.length ? last.sets[last.sets.length - 1] : { weight: 20, reps: 10 };

    const html = `
      <div class="tiny muted" style="margin-bottom:12px;font-weight:700">${esc(ex.name)} · ${D.MUSCLES[ex.primary].name}</div>
      <div class="row-in">
        <div class="field"><label>重量 (kg)</label>
          <input class="input" id="qw" type="number" inputmode="decimal" step="0.5" value="${lastSet.weight}" style="text-align:center;font-size:20px;font-weight:800;height:54px" /></div>
        <div class="field"><label>次数</label>
          <input class="input" id="qr" type="number" inputmode="numeric" value="${lastSet.reps}" style="text-align:center;font-size:20px;font-weight:800;height:54px" /></div>
      </div>
      <div class="card" style="margin-bottom:16px" id="qprev">${qlPrev(lastSet.weight, lastSet.reps)}</div>
      <button class="btn" id="doQ">保存这组</button>
    `;
    U.openSheet('记录一组', html, {
      after: () => {
        const w = $('#qw'), r = $('#qr');
        const upd = () => { $('#qprev').innerHTML = qlPrev(Number(w.value), Number(r.value)); };
        w.addEventListener('input', upd); r.addEventListener('input', upd);
        $('#sheetBody').addEventListener('click', e => {
          if (!e.target.closest('#doQ')) return;
          const weight = Number(w.value), reps = Number(r.value);
          if (!weight || !reps) { U.toast('请填写重量与次数'); return; }

          const k = S.todayKey();
          const d = S.day(k);
          if (!d.workouts.length) {
            d.workouts.push({ id: S.uid(), name: '自由训练', ts: Date.now(), dur: 45, exercises: [] });
          }
          const w0 = d.workouts[d.workouts.length - 1];
          let e0 = w0.exercises.find(x => x.exId === ex.id);
          if (!e0) { e0 = { exId: ex.id, name: ex.name, sets: [] }; w0.exercises.push(e0); }
          e0.sets.push({ id: S.uid(), weight, reps, done: true });

          // PR
          const rm = S.e1rm(weight, reps);
          const old = S.state.prs[ex.id];
          if (!old || rm > old.e1rm) {
            S.state.prs[ex.id] = { weight, reps, e1rm: rm, date: k };
            U.toast(`🎉 新纪录！估算 1RM ${rm} kg`);
          } else {
            U.toast(`已记录 ${weight}kg × ${reps}`);
          }
          S.bumpStreak(k);
          S.save();
          S.checkAchievements();
          U.closeSheet();
          render();
        });
      },
    });
  }

  function qlPrev(w, r) {
    const rm = S.e1rm(w, r);
    const vol = Math.round(w * r);
    return `<div style="display:flex">
      <div><div class="tiny muted">估算 1RM</div><div style="font-size:20px;font-weight:800">${rm || '--'}<span style="font-size:11px;color:var(--t3)"> kg</span></div></div>
      <div style="margin-left:auto;text-align:right"><div class="tiny muted">本组容量</div><div style="font-size:20px;font-weight:800">${vol}<span style="font-size:11px;color:var(--t3)"> kg</span></div></div>
    </div>`;
  }

  /* ==========================================================
     训练详情
     ========================================================== */
  function openWorkoutDetail(id) {
    const k = S.todayKey();
    const d = S.day(k);
    const w = d.workouts.find(x => x.id === id);
    if (!w) return;

    const html = `
      <div style="display:flex;gap:14px;margin-bottom:16px">
        <div><div class="tiny muted">容量</div><div style="font-size:22px;font-weight:800">${S.workoutVolume(w).toLocaleString()}<span style="font-size:11px;color:var(--t3)"> kg</span></div></div>
        <div><div class="tiny muted">组数</div><div style="font-size:22px;font-weight:800">${S.workoutSets(w)}</div></div>
        <div><div class="tiny muted">时长</div><div style="font-size:22px;font-weight:800">${w.dur}<span style="font-size:11px;color:var(--t3)"> 分</span></div></div>
      </div>
      ${w.exercises.map(ex => {
        const meta = D.EXERCISES.find(e => e.id === ex.exId);
        return `<div class="card" style="margin-bottom:11px;padding:13px 15px">
          <div style="display:flex;align-items:center;margin-bottom:8px">
            <div style="font-size:14px;font-weight:800">${esc(ex.name)}</div>
            <span class="tag" style="margin-left:auto;font-size:10px">${meta ? D.MUSCLES[meta.primary].name : ''}</span>
          </div>
          ${ex.sets.map((s, i) => `<div class="set-line">
            <span class="idx">${i + 1}</span>
            <span class="v">${s.weight}<span class="u"> kg</span></span>
            <span class="v">${s.reps}<span class="u"> 次</span></span>
            <span class="muted">${S.e1rm(s.weight, s.reps)}<span class="u"> 1RM</span></span>
            <span class="del" data-rmset="${ex.exId}|${s.id}">${ICON.trash}</span>
          </div>`).join('')}
        </div>`;
      }).join('')}
      <button class="btn ghost" id="addExToW" style="margin-top:6px">添加动作</button>
      <button class="btn" id="finishW" style="margin-top:10px">完成训练</button>
    `;

    U.openSheet(w.name, html, {
      after: () => {
        $('#sheetBody').addEventListener('click', e => {
          const rm = e.target.closest('[data-rmset]');
          if (rm) {
            const [exId, setId] = rm.dataset.rmset.split('|');
            const ex = w.exercises.find(x => x.exId === exId);
            if (ex) ex.sets = ex.sets.filter(s => s.id !== setId);
            S.save();
            U.closeSheet();
            openWorkoutDetail(id);
            render();
            return;
          }
          if (e.target.closest('#addExToW')) { openPickExercise(w); return; }
          if (e.target.closest('#finishW')) {
            U.closeSheet();
            U.toast('训练完成 💪');
            S.checkAchievements();
            render();
          }
        });
      },
    });
  }

  /* ==========================================================
     开始训练：选动作
     ========================================================== */
  function openAddWorkout() {
    const k = S.todayKey();
    const d = S.day(k);
    const html = `
      <div class="field"><label>训练名称</label>
        <input class="input" id="wname" value="自由训练" /></div>
      <div class="field"><label>时长（分钟）</label>
        <input class="input" id="wdur" type="number" inputmode="numeric" value="45" /></div>
      <div class="tiny muted" style="margin:14px 0 10px;font-weight:700">快速模板</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap;margin-bottom:18px">
        <button class="tag" data-tpl="push">推日 · 胸肩三头</button>
        <button class="tag" data-tpl="pull">拉日 · 背二头</button>
        <button class="tag" data-tpl="legs">腿日 · 下肢</button>
      </div>
      <button class="btn" id="doWk">创建训练</button>
      <div class="tiny muted center" style="margin-top:12px">创建后即可逐个动作记录组数</div>
    `;
    U.openSheet('开始训练', html, {
      after: () => {
        let tpl = null;
        $('#sheetBody').addEventListener('click', e => {
          const tp = e.target.closest('[data-tpl]');
          if (tp) {
            tpl = tp.dataset.tpl;
            $$('[data-tpl]').forEach(b => b.classList.toggle('red', b === tp));
            const names = { push: '推日 · 胸肩三头', pull: '拉日 · 背二头', legs: '腿日 · 下肢' };
            $('#wname').value = names[tpl];
            return;
          }
          if (!e.target.closest('#doWk')) return;
          const name = $('#wname').value.trim() || '自由训练';
          const dur = Number($('#wdur').value) || 45;
          const preset = {
            push: ['杠铃平板卧推', '上斜哑铃卧推', '哑铃侧平举', '绳索下压'],
            pull: ['高位下拉', '杠铃划船', '面拉', '哑铃交替弯举'],
            legs: ['杠铃深蹲', '罗马尼亚硬拉', '腿举', '站姿提踵'],
          };
          const exs = tpl ? preset[tpl].map(n => D.EXERCISES.find(x => x.name === n)).filter(Boolean)
                          : [];
          const w = {
            id: S.uid(), name, ts: Date.now(), dur,
            exercises: exs.map(ex => ({ exId: ex.id, name: ex.name, sets: [] })),
          };
          d.workouts.push(w);
          S.save();
          U.closeSheet();
          U.toast('训练已创建');
          render();
          setTimeout(() => openWorkoutDetail(w.id), 220);
        });
      },
    });
  }

  function openPickExercise(w) {
    const html = `
      <div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:10px">
        ${Object.entries(D.MUSCLES).map(([k, m]) => `<button class="tag" data-mf="${k}" style="white-space:nowrap">${m.name}</button>`).join('')}
      </div>
      <div id="exlist" style="max-height:52vh;overflow-y:auto">
        ${D.EXERCISES.map(ex => `
          <div class="row" data-pickex="${ex.id}" style="margin-bottom:7px">
            <div class="mid"><div class="t">${esc(ex.name)}</div>
              <div class="s">${D.MUSCLES[ex.primary].name} · ${esc(ex.equip)}</div></div>
            <span style="color:var(--t4)">${ICON.plus}</span>
          </div>`).join('')}
      </div>`;
    U.openSheet('选择动作', html, {
      after: () => {
        $('#sheetBody').addEventListener('click', e => {
          const mf = e.target.closest('[data-mf]');
          if (mf) {
            const k = mf.dataset.mf;
            $('#exlist').innerHTML = D.EXERCISES.filter(x => x.primary === k).map(ex => `
              <div class="row" data-pickex="${ex.id}" style="margin-bottom:7px">
                <div class="mid"><div class="t">${esc(ex.name)}</div>
                  <div class="s">${D.MUSCLES[ex.primary].name} · ${esc(ex.equip)}</div></div>
                <span style="color:var(--t4)">${ICON.plus}</span>
              </div>`).join('');
            return;
          }
          const pk = e.target.closest('[data-pickex]');
          if (pk) {
            const ex = D.EXERCISES.find(x => x.id === pk.dataset.pickex);
            if (ex && !w.exercises.find(x => x.exId === ex.id)) {
              w.exercises.push({ exId: ex.id, name: ex.name, sets: [] });
              S.save();
            }
            U.closeSheet();
            setTimeout(() => openWorkoutDetail(w.id), 180);
            render();
          }
        });
      },
    });
  }

  /* ==========================================================
     设置
     ========================================================== */
  function openSettings() {
    const p = S.state.profile;
    const t = S.calcTargets();
    const html = `
      <div class="field"><label>昵称</label><input class="input" id="sName" value="${esc(p.name)}" /></div>
      <div class="row-in">
        <div class="field"><label>性别</label>
          <select class="select" id="sSex">
            <option value="male" ${p.sex === 'male' ? 'selected' : ''}>男</option>
            <option value="female" ${p.sex === 'female' ? 'selected' : ''}>女</option>
          </select></div>
        <div class="field"><label>年龄</label><input class="input" id="sAge" type="number" value="${p.age}" /></div>
      </div>
      <div class="row-in">
        <div class="field"><label>身高 (cm)</label><input class="input" id="sH" type="number" value="${p.height}" /></div>
        <div class="field"><label>体重 (kg)</label><input class="input" id="sW" type="number" step="0.1" value="${p.weight}" /></div>
      </div>
      <div class="row-in">
        <div class="field"><label>目标体重 (kg)</label><input class="input" id="sTW" type="number" step="0.1" value="${p.targetWeight}" /></div>
        <div class="field"><label>目标速率 (kg/周)</label>
          <select class="select" id="sRate">
            ${[-0.75, -0.5, -0.25, 0, 0.25, 0.5].map(v => `<option value="${v}" ${p.goalRate == v ? 'selected' : ''}>${v > 0 ? '+' : ''}${v}</option>`).join('')}
          </select></div>
      </div>
      <div class="field"><label>活动水平</label>
        <select class="select" id="sAct">
          <option value="1.2" ${p.activity == 1.2 ? 'selected' : ''}>久坐（几乎不运动）</option>
          <option value="1.375" ${p.activity == 1.375 ? 'selected' : ''}>轻度（每周 1-3 练）</option>
          <option value="1.55" ${p.activity == 1.55 ? 'selected' : ''}>中度（每周 3-5 练）</option>
          <option value="1.725" ${p.activity == 1.725 ? 'selected' : ''}>高强度（每周 6-7 练）</option>
          <option value="1.9" ${p.activity == 1.9 ? 'selected' : ''}>极高（体力劳动）</option>
        </select></div>
      <div class="row-in">
        <div class="field"><label>蛋白 (g/kg)</label><input class="input" id="sP" type="number" step="0.1" value="${p.proteinPerKg}" /></div>
        <div class="field"><label>脂肪占比</label><input class="input" id="sF" type="number" step="0.05" value="${p.fatPct}" /></div>
      </div>

      <div class="card" style="margin:16px 0">
        <div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:700;color:var(--t2)">
          <span>BMR ${t.bmr}</span><span>TDEE ${t.tdee}</span><span style="color:var(--red)">目标 ${t.kcal}</span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;color:var(--t3);margin-top:7px">
          <span>蛋白 ${t.protein}g</span><span>碳水 ${t.carb}g</span><span>脂肪 ${t.fat}g</span>
        </div>
      </div>

      <button class="btn" id="doSave">保存设置</button>
    `;
    U.openSheet('个人设置', html, {
      after: () => {
        $('#sheetBody').addEventListener('click', e => {
          if (!e.target.closest('#doSave')) return;
          const g = id => $('#' + id);
          p.name = g('sName').value.trim() || '训练者';
          p.sex = g('sSex').value;
          p.age = Number(g('sAge').value) || 25;
          p.height = Number(g('sH').value) || 175;
          p.weight = Number(g('sW').value) || 70;
          p.targetWeight = Number(g('sTW').value) || 65;
          p.goalRate = Number(g('sRate').value);
          p.activity = Number(g('sAct').value);
          p.proteinPerKg = Number(g('sP').value) || 2;
          p.fatPct = Number(g('sF').value) || .25;
          S.save();
          U.closeSheet();
          U.toast('设置已保存');
          render();
        });
      },
    });
  }

  /* ==========================================================
     主题市场
     ========================================================== */
  function openThemes() {
    const cur = S.state.profile.theme;
    const html = `
      <div class="tiny muted" style="margin-bottom:14px">选择一套配色，立即应用到整个 App。</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px">
        ${D.THEMES.map(th => `
          <div data-th="${th.id}" style="cursor:pointer;border-radius:18px;overflow:hidden;
            border:2px solid ${cur === th.id ? th.accent : 'rgba(255,255,255,.08)'};background:${th.bg}">
            <div style="height:74px;background:radial-gradient(90% 120% at 50% 110%, ${th.glow}, transparent 70%)"></div>
            <div style="padding:10px 12px;display:flex;align-items:center;gap:8px">
              <span style="width:14px;height:14px;border-radius:50%;background:${th.accent};box-shadow:0 0 10px ${th.accent}"></span>
              <span style="font-size:13px;font-weight:800">${th.name}</span>
              ${cur === th.id ? `<span style="margin-left:auto;color:${th.accent}">${ICON.check}</span>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
    U.openSheet('主题市场', html, {
      after: () => {
        $('#sheetBody').addEventListener('click', e => {
          const th = e.target.closest('[data-th]');
          if (!th) return;
          S.applyTheme(th.dataset.th);
          U.closeSheet();
          U.toast('主题已应用');
          render();
        });
      },
    });
  }

  /* ==========================================================
     成就 / 纪录 / 计划 / 段位 / 动作库
     ========================================================== */
  function openAchievements() {
    const got = S.state.achievements;
    const html = `
      <div class="tiny muted" style="margin-bottom:14px">已解锁 ${got.length} / ${D.ACHIEVEMENTS.length}</div>
      <div style="display:flex;flex-direction:column;gap:9px">
        ${D.ACHIEVEMENTS.map(a => {
          const on = got.includes(a.id);
          return `<div class="row" style="opacity:${on ? 1 : .45}">
            <div class="ico" style="font-size:20px;background:${on ? 'rgba(255,59,48,.14)' : 'rgba(255,255,255,.05)'}">${a.icon}</div>
            <div class="mid"><div class="t">${a.name}</div><div class="s">${a.desc}</div></div>
            ${on ? `<span style="color:var(--red)">${ICON.check}</span>` : `<span class="tiny muted">未解锁</span>`}
          </div>`;
        }).join('')}
      </div>`;
    U.openSheet('成就', html);
  }

  function openPRs() {
    const prs = Object.keys(S.state.prs).map(id => {
      const ex = D.EXERCISES.find(e => e.id === id);
      return ex ? { ex, pr: S.state.prs[id] } : null;
    }).filter(Boolean).sort((a, b) => b.pr.e1rm - a.pr.e1rm);
    const html = prs.length ? prs.map(({ ex, pr }) => `
      <div class="row" data-ex="${ex.id}">
        <div class="mid"><div class="t">${esc(ex.name)}</div>
          <div class="s">${pr.weight}kg × ${pr.reps} · ${pr.date}</div></div>
        <div class="r"><div class="n">${pr.e1rm}</div><div class="u">估算1RM</div></div>
      </div>`).join('') : `<div class="empty">还没有个人纪录，去练一组吧</div>`;
    U.openSheet('个人纪录', html, {
      after: () => {
        $('#sheetBody').addEventListener('click', e => {
          const ex = e.target.closest('[data-ex]');
          if (ex) { U.closeSheet(); setTimeout(() => openExercise(ex.dataset.ex), 200); }
        });
      },
    });
  }

  function openAllExercises() {
    const html = `
      <div style="display:flex;gap:7px;overflow-x:auto;padding-bottom:10px">
        ${Object.entries(D.MUSCLES).map(([k, m]) => `<button class="tag" data-mf="${k}" style="white-space:nowrap">${m.name}</button>`).join('')}
      </div>
      <div id="exlist" style="max-height:58vh;overflow-y:auto">
        ${exRows(D.EXERCISES)}
      </div>`;
    U.openSheet('动作库', html, {
      after: () => {
        $('#sheetBody').addEventListener('click', e => {
          const mf = e.target.closest('[data-mf]');
          if (mf) { $('#exlist').innerHTML = exRows(D.EXERCISES.filter(x => x.primary === mf.dataset.mf)); return; }
          const ex = e.target.closest('[data-ex2]');
          if (ex) { U.closeSheet(); setTimeout(() => openExercise(ex.dataset.ex2), 200); }
        });
      },
    });
  }
  function exRows(list) {
    return list.map(ex => `
      <div class="row" data-ex2="${ex.id}" style="margin-bottom:7px">
        <div class="mid"><div class="t">${esc(ex.name)}</div>
          <div class="s">${D.MUSCLES[ex.primary].name} · ${esc(ex.equip)}</div></div>
        ${ICON.arrow}
      </div>`).join('');
  }

  function openPlan() {
    const t = S.calcTargets();
    const html = `
      <div class="card glow" style="margin-bottom:14px">
        <div style="font-size:15px;font-weight:800;margin-bottom:6px">减脂期 · 标准方案</div>
        <div class="tiny muted">基于你的 TDEE ${t.tdee} kcal 自动生成</div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px">
          <div><div class="tiny muted">热量</div><div style="font-size:19px;font-weight:800">${t.kcal}</div></div>
          <div><div class="tiny muted">蛋白</div><div style="font-size:19px;font-weight:800;color:var(--purple)">${t.protein}g</div></div>
          <div><div class="tiny muted">碳水</div><div style="font-size:19px;font-weight:800;color:var(--green)">${t.carb}g</div></div>
        </div>
      </div>
      <div class="sec-title" style="margin:0 2px 10px"><span class="dot"></span>训练安排</div>
      ${[
        ['周一', '推日 · 胸肩三头', '卧推 4×6-8 · 上斜 3×8-10 · 侧平举 3×12-15 · 绳索下压 3×12'],
        ['周二', '有氧 + 核心', '快走 30 分钟 · 卷腹 3×15 · 平板支撑 3×45s'],
        ['周三', '拉日 · 背二头', '高位下拉 4×8-10 · 划船 4×8 · 面拉 3×15 · 弯举 3×12'],
        ['周四', '休息', '散步 6000 步 · 拉伸 10 分钟'],
        ['周五', '腿日 · 下肢', '深蹲 4×6-8 · RDL 3×8 · 腿举 3×10 · 提踵 4×15'],
        ['周六', '上肢综合', '肩推 3×8 · 侧平举 3×15 · 引体 3×力竭 · 三头 3×12'],
        ['周日', '休息', '恢复日，保证 7.5 小时睡眠'],
      ].map(([d, n, s]) => `
        <div class="card" style="margin-bottom:9px;padding:13px 15px">
          <div style="display:flex;align-items:center">
            <span style="font-size:12px;font-weight:800;color:var(--red);width:34px">${d}</span>
            <span style="font-size:13.5px;font-weight:800">${n}</span>
          </div>
          <div class="tiny muted" style="margin-top:6px;line-height:1.6;padding-left:34px">${s}</div>
        </div>`).join('')}`;
    U.openSheet('官方计划', html);
  }

  function openRank() {
    const vol = Object.values(S.state.days).reduce((a, dd) =>
      a + (dd.workouts || []).reduce((b, w) => b + S.workoutVolume(w), 0), 0);
    const tiers = [
      [0, '青铜', '刚开始的人'],
      [5000, '白银', '建立习惯'],
      [20000, '黄金', '稳定训练'],
      [50000, '铂金', '进阶力量'],
      [100000, '钻石', '硬核选手'],
      [200000, '王者', '天花板'],
    ];
    const cur = tiers.filter(t => vol >= t[0]).pop() || tiers[0];
    const next = tiers.find(t => vol < t[0]);
    const pct = next ? (vol - cur[0]) / (next[0] - cur[0]) : 1;

    const html = `
      <div class="card glow" style="text-align:center;margin-bottom:16px">
        <div style="font-size:44px;line-height:1">🏅</div>
        <div style="font-size:24px;font-weight:800;margin-top:8px">${cur[1]}</div>
        <div class="tiny muted" style="margin-top:4px">${cur[2]}</div>
        <div class="prog" style="margin-top:16px"><i style="width:${Math.min(100, pct * 100)}%"></i></div>
        <div class="tiny muted" style="margin-top:8px">
          ${next ? `再练 ${(next[0] - vol).toLocaleString()} kg 容量升到 ${next[1]}` : '已达最高段位'}
        </div>
      </div>
      ${tiers.map(([v, n, d], i) => `
        <div class="row" style="opacity:${vol >= v ? 1 : .4};margin-bottom:7px">
          <div class="ico">${['🥉', '🥈', '🥇', '💎', '💠', '👑'][i]}</div>
          <div class="mid"><div class="t">${n}</div><div class="s">${d}</div></div>
          <div class="r"><div class="n" style="font-size:12px">${v.toLocaleString()}</div><div class="u">kg</div></div>
        </div>`).join('')}`;
    U.openSheet('段位', html);
  }

  /* ==========================================================
     导入导出
     ========================================================== */
  function doExport() {
    const txt = S.exportJSON();
    const blob = new Blob([txt], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `norg-backup-${S.todayKey()}.json`;
    a.click();
    U.toast('已导出备份文件');
  }

  function doImport() {
    const html = `
      <div class="tiny muted" style="margin-bottom:12px">粘贴之前导出的 JSON 内容，或选择文件。</div>
      <textarea class="input" id="impTxt" style="height:160px;padding:12px;resize:none;font-size:12px;font-family:var(--mono)" placeholder='{"profile":{...}}'></textarea>
      <input type="file" id="impFile" accept=".json" style="margin:12px 0;font-size:12px;color:var(--t3)" />
      <button class="btn" id="doImp" style="margin-top:10px">导入</button>`;
    U.openSheet('导入数据', html, {
      after: () => {
        const f = $('#impFile');
        f.addEventListener('change', () => {
          const file = f.files[0];
          if (!file) return;
          const r = new FileReader();
          r.onload = () => { $('#impTxt').value = r.result; };
          r.readAsText(file);
        });
        $('#sheetBody').addEventListener('click', e => {
          if (!e.target.closest('#doImp')) return;
          try {
            S.importJSON($('#impTxt').value);
            U.closeSheet();
            U.toast('导入成功');
            render();
          } catch (err) { U.toast('导入失败：' + err.message); }
        });
      },
    });
  }

  function doReset() {
    const html = `
      <div class="tiny muted" style="line-height:1.7;margin-bottom:16px">
        将清空全部饮食、训练、体重记录并恢复演示数据。此操作不可撤销。
      </div>
      <button class="btn" id="doR" style="background:linear-gradient(135deg,#ff5a4e,#8e0f16)">确认清空</button>`;
    U.openSheet('清空数据', html, {
      after: () => {
        $('#sheetBody').addEventListener('click', e => {
          if (!e.target.closest('#doR')) return;
          S.reset();
          U.closeSheet();
          U.toast('已重置');
          render();
        });
      },
    });
  }

  /* ==========================================================
     启动
     ========================================================== */
  function boot() {
    S.load();
    S.applyTheme(S.state.profile.theme || 'crimson');
    S.checkAchievements();
    bindGlobal();
    render();

    // 注册 SW
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.NorgApp = { render, openAddMeal, openExercise };
})(window);
