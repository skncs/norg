/* ============================================================
   Norg · 视图层
   今日 / 饮食 / 训练 / 数据 / 设置
   ============================================================ */
(function (global) {
  'use strict';

  const S = global.NorgStore;
  const C = global.NorgChart;
  const U = global.NorgUI;
  const D = global.NORG_DATA;
  const esc = U.esc, ICON = U.ICON;

  let mode = 'diet';        // 今日页模式：diet / train
  let viewDate = null;      // 浏览的日期（null = 今天）
  let curTab = 'today';
  let planSub = null;       // 计划页子视图：null / {type:'session',key} / {type:'meal'}

  const V = {};

  /* ==========================================================
     今日
     ========================================================== */
  V.today = function () {
    const k = viewDate || S.todayKey();
    const t = S.calcTargets();
    const tot = S.dayTotals(k);
    const p = S.state.profile;
    const d = S.day(k);

    const pct = Math.min(1, tot.kcal / t.kcal);
    const left = t.kcal - tot.kcal;

    const pctP = Math.min(1, tot.p / t.protein);
    const pctC = Math.min(1, tot.c / t.carb);
    const pctF = Math.min(1, tot.f / t.fat);

    // 训练模式数据
    const vol = S.dayVolume(k);
    const wsets = d.workouts.reduce((a, w) => a + S.workoutSets(w), 0);
    const musc = S.muscleVolume(7);

    // 体重
    const ws = S.weightSeries(14);
    const curW = d.weight != null ? d.weight : p.weight;
    const prevW = (() => {
      for (let i = 1; i <= 14; i++) {
        const dd = S.state.days[S.dayOffset(k, -i)];
        if (dd && dd.weight != null) return dd.weight;
      }
      return null;
    })();
    const wDelta = prevW != null ? S.round(curW - prevW, 1) : null;
    const avg7 = S.weightAvg(7);

    // 缺口
    const bal = S.calorieBalance(k);

    // PR
    const prKeys = Object.keys(S.state.prs);
    const bestPr = prKeys.map(id => {
      const ex = D.EXERCISES.find(e => e.id === id);
      return ex ? { ex, pr: S.state.prs[id] } : null;
    }).filter(Boolean).sort((a, b) => b.pr.e1rm - a.pr.e1rm)[0];

    const isToday = k === S.todayKey();
    const dateLabel = isToday ? '今日' : `${k.slice(5).replace('-', '/')}`;

    return `
    <div style="display:flex;align-items:center;gap:8px;margin:6px 4px 0;">
      <button class="round-btn" data-act="prevday" style="width:34px;height:34px;flex:0 0 auto">${ICON.back}</button>
      <div style="font-size:24px;font-weight:800;letter-spacing:-.8px;flex:0 0 auto;">${dateLabel}</div>
      ${!isToday ? `<button class="round-btn" style="width:30px;height:30px" data-act="nextday">${ICON.arrow}</button>` : ''}
      <div style="margin-left:auto;flex:0 0 auto">
        <div class="mode-seg">
          <button class="${mode === 'diet' ? 'on' : ''}" data-mode="diet">饮食</button>
          <button class="${mode === 'train' ? 'on' : ''}" data-mode="train">训练</button>
        </div>
      </div>
    </div>

    ${mode === 'diet' ? dietHero(t, tot, pct, left, pctP, pctC, pctF, k) : trainHero(vol, wsets, d)}

    <div class="quick-row">
      ${quick('学院', ICON.medal, false, 'college')}
      ${quick('成就', ICON.trophy, false, 'achv')}
      ${quick('官方计划', ICON.plan, true, 'plan')}
      ${quick('段位', ICON.rank, false, 'rank')}
      ${quick('主题市场', ICON.store, false, 'themes')}
    </div>

    <div class="sec-title"><span class="dot"></span>身体数据<span class="more" data-act="editweight">编辑</span></div>

    <div class="grid2">
      <div class="mini" data-act="editweight" style="cursor:pointer">
        <div class="h"><span>${isToday ? '今日体重' : '当日体重'}</span>
          <span style="color:var(--red);font-size:15px;line-height:1">+</span></div>
        <div class="big">${curW.toFixed(1)}<span>kg</span></div>
        <div class="foot">
          ${wDelta != null ? `<span style="color:${wDelta <= 0 ? 'var(--green)' : 'var(--orange)'};font-weight:800">${wDelta <= 0 ? '↓' : '↑'}${Math.abs(wDelta).toFixed(1)}</span> 较上次` : '暂无对比'}
        </div>
        <div style="margin-top:8px">${C.line({ w: 150, h: 40, points: ws, dots: false, minPad: .5 })}</div>
        <div class="foot" style="display:flex;justify-content:space-between">
          <span>7 天前</span><span>7 日均 ${avg7 != null ? avg7 : '--'}</span>
        </div>
      </div>

      <div class="mini" style="min-width:0">
        <div class="ring-cell">
          ${C.ring({
            size: 84, stroke: 9, gap: 6,
            segments: [
              { value: tot.c || .001, color: 'var(--green)' },
              { value: tot.p || .001, color: 'var(--purple)' },
              { value: tot.f || .001, color: 'var(--yellow)' },
            ],
            center: String(tot.kcal), sub: 'kcal',
          })}
          <div class="legend">
            <span><i style="background:var(--green)"></i>${Math.round(tot.c)}g 碳水</span>
            <span><i style="background:var(--purple)"></i>${Math.round(tot.p)}g 蛋白</span>
            <span><i style="background:var(--yellow)"></i>${Math.round(tot.f)}g 脂肪</span>
          </div>
        </div>
      </div>

      <div class="mini">
        <div class="h"><span>热量缺口</span></div>
        <div style="display:grid;place-items:center;margin-top:2px">
          ${C.gauge({
            w: 168, h: 100, value: bal.deficit, min: -1200, max: 1600,
            label: String(Math.round(bal.deficit)), sub: 'kcal 缺口',
            color: bal.deficit > 0 ? 'var(--red)' : 'var(--orange)',
          })}
        </div>
        <div class="foot center">缺口区 · 摄入 ${bal.intake} / 消耗 ${bal.burn}</div>
      </div>

      <div class="mini" data-act="pr" style="cursor:pointer">
        <div class="h"><span>个人纪录</span>${ICON.arrow}</div>
        ${bestPr ? `
          <div style="margin-top:6px;display:flex;align-items:center;gap:9px">
            <div style="width:44px;height:52px;flex:0 0 auto">${C.bodyMap({ data: { [bestPr.ex.primary]: 1 }, w: 44, h: 52, mode: 'front' })}</div>
            <div>
              <div style="font-size:12.5px;font-weight:700;color:var(--t2)">${esc(bestPr.ex.name)}</div>
              <div style="font-size:24px;font-weight:800;letter-spacing:-1px;line-height:1.15">${bestPr.pr.e1rm}<span style="font-size:11px;color:var(--t3);font-weight:600"> kg</span></div>
              <div class="tiny muted">估算 1RM</div>
            </div>
          </div>` : `<div class="empty" style="padding:20px 0">还没有纪录</div>`}
      </div>

      <div class="mini">
        <div class="h"><span>训练分布</span>${ICON.arrow}</div>
        <div class="muscle-wrap" style="margin-top:6px">
          <div>${C.bodyMap({ data: musc, w: 72, h: 112, mode: 'front' })}</div>
          <div>${C.bodyMap({ data: musc, w: 72, h: 112, mode: 'back' })}</div>
        </div>
        <div class="foot">近 7 天训练量分布</div>
      </div>

      <div class="mini">
        <div class="h"><span>睡眠</span>${ICON.arrow}</div>
        <div class="big">${d.sleep != null ? d.sleep.toFixed(1) : '--'}<span>小时</span></div>
        <div class="foot">昨夜 · 目标 7.5h</div>
        <div style="margin-top:10px">${C.bars({ w: 150, h: 34, data: weekSleep(), color: 'var(--purple)' })}</div>
      </div>

      <div class="mini">
        <div class="h"><span>训练容量</span>${ICON.arrow}</div>
        <div class="big">${vol.toLocaleString()}<span>kg</span></div>
        <div class="foot">${d.workouts.length} 次训练 · ${wsets} 组</div>
      </div>

      <div class="mini">
        <div class="h"><span>活动消耗</span>${ICON.arrow}</div>
        <div class="big">${bal.exerciseBurn}<span>大卡</span></div>
        <div class="foot">来自训练容量估算</div>
      </div>
    </div>

    <div class="sec-title"><span class="dot"></span>本周摄入<span class="more" data-act="goDiet">查看全部</span></div>
    <div class="card">
      ${C.bars({
        w: 300, h: 104,
        data: weekKcal(),
        goal: t.kcal,
        labels: weekLabels(),
        color: 'var(--red)',
      })}
      <div class="tiny muted center" style="margin-top:6px">虚线为目标 ${t.kcal} kcal</div>
    </div>

    <div style="height:8px"></div>
    `;
  };

  function quick(label, icon, on, act) {
    return `<button class="quick ${on ? 'on' : ''}" data-act="${act}">${icon}<span>${label}</span></button>`;
  }

  function dietHero(t, tot, pct, left, pctP, pctC, pctF, k) {
    const d = S.day(k);
    const slots = ['早餐', '午餐', '晚餐', '加餐'];
    const cnt = d.meals.length;
    return `
    <div class="hero">
      <div class="hero-top">
        <div>
          <div class="hero-kcal"><b class="num">${tot.kcal.toLocaleString()}</b><i>kcal</i></div>
          <div class="hero-sub">已记录 ${cnt} 餐${left > 0 ? ` · 还可摄入 ${left} kcal` : ` · 已超出 ${Math.abs(left)} kcal`}</div>
        </div>
        <div class="hero-btns">
          <button class="round-btn" data-act="addMeal" title="记录饮食">${ICON.bowl}</button>
          <button class="round-btn" data-act="editweight" title="记录体重">${ICON.edit}</button>
        </div>
      </div>

      <div class="bar-wrap">
        <div class="bar"><div class="bar-fill" style="width:${Math.max(2, pct * 100)}%"></div></div>
        <div class="bar-pct">${Math.round(pct * 100)}%</div>
      </div>

      <div class="macros">
        <div class="macro"><div class="k">蛋白质</div><div class="v">${Math.round(tot.p)}<span>g</span></div>
          <div class="prog" style="margin-top:6px"><i style="width:${pctP * 100}%;background:linear-gradient(90deg,#c4b5fd,#7c3aed)"></i></div></div>
        <div class="macro"><div class="k">碳水</div><div class="v">${Math.round(tot.c)}<span>g</span></div>
          <div class="prog" style="margin-top:6px"><i style="width:${pctC * 100}%;background:linear-gradient(90deg,#6ee7a0,#16a34a)"></i></div></div>
        <div class="macro"><div class="k">脂肪</div><div class="v">${Math.round(tot.f)}<span>g</span></div>
          <div class="prog" style="margin-top:6px"><i style="width:${pctF * 100}%;background:linear-gradient(90deg,#f7ff8a,#a3b800)"></i></div></div>
      </div>

      <div class="goal-arc">目标 <b>${t.kcal.toLocaleString()}</b> kcal · TDEE ${t.tdee} · BMR ${t.bmr}</div>
    </div>

    ${d.meals.length ? `
      <div class="sec-title"><span class="dot"></span>今日记录<span class="more" data-act="addMeal">+ 添加</span></div>
      <div class="list">
        ${slots.map(sl => {
          const items = d.meals.filter(m => m.slot === sl);
          if (!items.length) return '';
          const sum = items.reduce((a, m) => a + m.kcal, 0);
          return `<div class="card" style="padding:12px 14px">
            <div style="display:flex;align-items:center;margin-bottom:8px">
              <span style="font-size:13px;font-weight:800">${sl}</span>
              <span class="tiny muted" style="margin-left:auto">${sum} kcal</span>
            </div>
            ${items.map(m => `
              <div class="row" style="background:transparent;border:0;padding:8px 0" data-meal="${m.id}">
                <div class="mid"><div class="t" style="font-size:13.5px">${esc(m.name)}</div>
                  <div class="s">${m.grams}g · 蛋白 ${m.p}g · 碳水 ${m.c}g · 脂肪 ${m.f}g</div></div>
                <div class="r"><div class="n">${m.kcal}</div><div class="u">kcal</div></div>
                <button class="icon-btn" style="width:26px;height:26px;background:transparent;color:var(--t4)" data-del="${m.id}">${ICON.trash}</button>
              </div>`).join('')}
          </div>`;
        }).join('')}
      </div>` : `
      <div class="card" style="margin-top:14px">
        <div class="empty">
          ${ICON.bowl}
          <div>今天还没有记录饮食</div>
          <button class="btn sm" style="margin-top:14px;max-width:180px" data-act="addMeal">记录第一餐</button>
        </div>
      </div>`}
    `;
  }

  function trainHero(vol, sets, d) {
    const t = S.calcTargets();
    const cnt = d.workouts.length;
    return `
    <div class="hero">
      <div class="hero-top">
        <div>
          <div class="hero-kcal"><b class="num">${vol.toLocaleString()}</b><i>kg 容量</i></div>
          <div class="hero-sub">${cnt} 次训练 · ${sets} 组有效组</div>
        </div>
        <div class="hero-btns">
          <button class="round-btn" data-act="addWorkout" title="开始训练">${ICON.dumbbell}</button>
        </div>
      </div>
      <div class="bar-wrap">
        <div class="bar"><div class="bar-fill" style="width:${Math.min(100, vol / 250)}%"></div></div>
        <div class="bar-pct">${cnt}</div>
      </div>
      <div class="goal-arc">建议每周 3-5 练 · 目标 ${t.kcal} kcal 摄入</div>
    </div>

    ${d.workouts.length ? `
      <div class="sec-title"><span class="dot"></span>今日训练<span class="more" data-act="addWorkout">+ 新增</span></div>
      ${d.workouts.map(w => `
        <div class="card" style="margin-bottom:11px">
          <div style="display:flex;align-items:center;gap:10px">
            <div style="flex:1">
              <div style="font-size:15px;font-weight:800">${esc(w.name)}</div>
              <div class="tiny muted" style="margin-top:4px">${w.dur} 分钟 · ${S.workoutVolume(w).toLocaleString()} kg · ${S.workoutSets(w)} 组</div>
            </div>
            <button class="icon-btn" data-workout="${w.id}">${ICON.arrow}</button>
          </div>
          <div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px">
            ${w.exercises.map(ex => `<span class="tag">${esc(ex.name)} ${ex.sets.length}×</span>`).join('')}
          </div>
        </div>`).join('')}` : `
      <div class="card" style="margin-top:14px">
        <div class="empty">${ICON.dumbbell}
          <div>今天还没有训练记录</div>
          <button class="btn sm" style="margin-top:14px;max-width:180px" data-act="addWorkout">开始训练</button>
        </div>
      </div>`}
    `;
  }

  function weekKcal() {
    const out = [];
    for (let i = 6; i >= 0; i--) out.push(S.dayTotals(S.dayOffset(S.todayKey(), -i)).kcal);
    return out;
  }
  function weekLabels() {
    const out = [];
    const names = ['日', '一', '二', '三', '四', '五', '六'];
    for (let i = 6; i >= 0; i--) {
      const k = S.dayOffset(S.todayKey(), -i);
      out.push(names[new Date(k + 'T00:00:00').getDay()]);
    }
    return out;
  }
  function weekSleep() {
    const out = [];
    for (let i = 6; i >= 0; i--) {
      const d = S.state.days[S.dayOffset(S.todayKey(), -i)];
      out.push(d && d.sleep ? d.sleep : 0);
    }
    return out;
  }

  /* ==========================================================
     饮食
     ========================================================== */
  V.diet = function () {
    const k = S.todayKey();
    const t = S.calcTargets();
    const tot = S.dayTotals(k);
    const d = S.day(k);
    const slots = ['早餐', '午餐', '晚餐', '加餐'];

    return `
    <div class="sec-title" style="margin-top:8px"><span class="dot"></span>营养摄入</div>
    <div class="card glow">
      <div style="display:flex;align-items:center;gap:16px">
        ${C.ring({
          size: 112, stroke: 11, gap: 6,
          segments: [
            { value: Math.max(.001, t.carb - tot.c), color: 'rgba(61,220,132,.22)' },
            { value: Math.max(.001, tot.c), color: 'var(--green)' },
            { value: Math.max(.001, tot.p), color: 'var(--purple)' },
            { value: Math.max(.001, tot.f), color: 'var(--yellow)' },
          ],
          center: String(tot.kcal), sub: '已摄入',
        })}
        <div style="flex:1">
          <div style="font-size:13px;color:var(--t3);font-weight:700">今日剩余</div>
          <div style="font-size:32px;font-weight:800;letter-spacing:-1.4px;line-height:1.15">${Math.max(0, t.kcal - tot.kcal)}<span style="font-size:13px;color:var(--t3);font-weight:600"> kcal</span></div>
          <div class="tiny muted" style="margin-top:6px">目标 ${t.kcal} · 已摄入 ${tot.kcal}</div>
        </div>
      </div>

      <div style="margin-top:16px;display:flex;flex-direction:column;gap:12px">
        ${macroBar('蛋白质', tot.p, t.protein, 'var(--purple)', '#7c3aed')}
        ${macroBar('碳水', tot.c, t.carb, 'var(--green)', '#16a34a')}
        ${macroBar('脂肪', tot.f, t.fat, 'var(--yellow)', '#a3b800')}
      </div>
    </div>

    <div class="sec-title"><span class="dot"></span>今日饮食<span class="more" data-act="addMeal">+ 添加</span></div>

    ${slots.map(sl => {
      const items = d.meals.filter(m => m.slot === sl);
      const sum = items.reduce((a, m) => a + m.kcal, 0);
      return `<div class="card" style="margin-bottom:11px;padding:14px">
        <div style="display:flex;align-items:center;margin-bottom:${items.length ? 8 : 0}px">
          <div style="font-size:14px;font-weight:800">${sl}</div>
          <div class="tiny muted" style="margin-left:8px">${items.length ? sum + ' kcal' : '未记录'}</div>
          <button class="icon-btn" style="margin-left:auto;width:28px;height:28px" data-addslot="${sl}">${ICON.plus}</button>
        </div>
        ${items.map(m => `
          <div class="row" style="background:transparent;border:0;padding:8px 0">
            <div class="mid"><div class="t" style="font-size:13.5px">${esc(m.name)}</div>
              <div class="s">${m.grams}g · P${m.p} C${m.c} F${m.f}</div></div>
            <div class="r"><div class="n">${m.kcal}</div><div class="u">kcal</div></div>
            <button class="icon-btn" style="width:26px;height:26px;background:transparent;color:var(--t4)" data-del="${m.id}">${ICON.trash}</button>
          </div>`).join('')}
      </div>`;
    }).join('')}

    <div class="sec-title"><span class="dot"></span>快捷添加</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">
      ${['鸡胸肉', '鸡蛋', '米饭', '牛奶', '燕麦片', '西兰花', '香蕉', '乳清蛋白粉'].map(n => {
        const f = D.FOODS.find(x => x.name === n);
        return f ? `<button class="tag" data-quick="${f.id}" style="padding:9px 14px;font-size:12.5px">${n} · ${f.serving}g</button>` : '';
      }).join('')}
    </div>

    <div style="height:8px"></div>`;
  };

  function macroBar(name, cur, goal, c1, c2) {
    const pct = Math.min(1, cur / (goal || 1));
    return `<div>
      <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:5px">
        <span style="color:var(--t2)">${name}</span>
        <span><b style="font-size:13px">${Math.round(cur)}</b><span class="muted" style="font-weight:600"> / ${goal}g</span></span>
      </div>
      <div class="prog"><i style="width:${pct * 100}%;background:linear-gradient(90deg,${c1},${c2})"></i></div>
    </div>`;
  }

  /* ==========================================================
     训练
     ========================================================== */
  V.train = function () {
    const k = S.todayKey();
    const d = S.day(k);
    const musc = S.muscleVolume(7);
    const totalVol = Object.values(S.state.days).reduce((a, dd) =>
      a + (dd.workouts || []).reduce((b, w) => b + S.workoutVolume(w), 0), 0);

    const prs = Object.keys(S.state.prs).map(id => {
      const ex = D.EXERCISES.find(e => e.id === id);
      return ex ? { ex, pr: S.state.prs[id] } : null;
    }).filter(Boolean).sort((a, b) => b.pr.e1rm - a.pr.e1rm);

    return `
    <div class="sec-title" style="margin-top:8px"><span class="dot"></span>训练概览</div>
    <div class="card glow">
      <div style="display:flex;gap:14px;align-items:center">
        <div style="flex:1">
          <div class="tiny muted" style="font-weight:700">累计容量</div>
          <div style="font-size:30px;font-weight:800;letter-spacing:-1.4px;line-height:1.2">${totalVol.toLocaleString()}<span style="font-size:12px;color:var(--t3)"> kg</span></div>
          <div class="tiny muted" style="margin-top:5px">共 ${S.totalWorkouts()} 次训练</div>
        </div>
        <div style="text-align:center">
          ${C.progressRing({ size: 78, stroke: 8, pct: Math.min(1, S.totalWorkouts() / 30), label: String(S.totalWorkouts()), sub: '次' })}
        </div>
      </div>
    </div>

    <div class="sec-title"><span class="dot"></span>肌群分布<span class="more">近 7 天</span></div>
    <div class="card" style="padding:12px">
      <div id="train3d" style="height:300px;border-radius:18px;overflow:hidden;background:radial-gradient(80% 80% at 50% 20%, rgba(255,59,48,.08), transparent 70%)"></div>
      <div class="tiny muted center" style="margin-top:8px">3D 肌群热力图 · 越红练得越多 · 可拖动旋转</div>
      <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:7px 14px">
        ${Object.entries(D.MUSCLES).filter(([mk]) => musc[mk]).sort((a, b) => musc[b[0]] - musc[a[0]]).slice(0, 8).map(([mk, m]) => `
          <div style="display:flex;align-items:center;gap:7px;font-size:11.5px;font-weight:700">
            <i style="width:7px;height:7px;border-radius:50%;background:${m.color};flex:0 0 auto"></i>
            <span style="color:var(--t2)">${m.name}</span>
            <span style="margin-left:auto;color:var(--t3);font-weight:600">${Math.round(musc[mk] / 100) / 10}t</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="sec-title"><span class="dot"></span>今日训练<span class="more" data-act="addWorkout">+ 新增</span></div>
    ${d.workouts.length ? d.workouts.map(w => `
      <div class="card" style="margin-bottom:11px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="flex:1">
            <div style="font-size:15px;font-weight:800">${esc(w.name)}</div>
            <div class="tiny muted" style="margin-top:4px">${w.dur} 分钟 · ${S.workoutVolume(w).toLocaleString()} kg · ${S.workoutSets(w)} 组</div>
          </div>
          <button class="icon-btn" data-workout="${w.id}">${ICON.arrow}</button>
        </div>
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:4px">
          ${w.exercises.map(ex => `
            <div style="display:flex;font-size:12.5px;font-weight:600;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04)">
              <span style="color:var(--t2)">${esc(ex.name)}</span>
              <span style="margin-left:auto;color:var(--t3)">${ex.sets.length} 组 · ${Math.max(...ex.sets.map(s => s.weight))}kg</span>
            </div>`).join('')}
        </div>
      </div>`).join('') : `<div class="card"><div class="empty">${ICON.dumbbell}<div>今天还没练</div>
        <button class="btn sm" style="margin-top:14px;max-width:180px" data-act="addWorkout">开始训练</button></div></div>`}

    <div class="sec-title"><span class="dot"></span>动作库<span class="more" data-act="allEx">全部 ${D.EXERCISES.length} 个</span></div>
    <div class="list">
      ${D.EXERCISES.slice(0, 8).map(ex => `
        <div class="row" data-ex="${ex.id}">
          <div class="ico" style="background:${D.MUSCLES[ex.primary].color}22;border-color:${D.MUSCLES[ex.primary].color}44">
            <span style="width:9px;height:9px;border-radius:50%;background:${D.MUSCLES[ex.primary].color}"></span>
          </div>
          <div class="mid">
            <div class="t">${esc(ex.name)}</div>
            <div class="s">${D.MUSCLES[ex.primary].name} · ${ex.equip}</div>
          </div>
          ${ICON.arrow}
        </div>`).join('')}
    </div>

    <div class="sec-title"><span class="dot"></span>个人纪录</div>
    <div class="list">
      ${prs.length ? prs.map(({ ex, pr }) => `
        <div class="row" data-ex="${ex.id}">
          <div class="mid">
            <div class="t">${esc(ex.name)}</div>
            <div class="s">${pr.weight}kg × ${pr.reps} · ${pr.date}</div>
          </div>
          <div class="r"><div class="n">${pr.e1rm}</div><div class="u">估算1RM</div></div>
        </div>`).join('') : `<div class="card"><div class="empty">还没有个人纪录</div></div>`}
    </div>

    <div style="height:8px"></div>`;
  };

  /* ==========================================================
     数据
     ========================================================== */
  V.body = function () {
    const p = S.state.profile;
    const t = S.calcTargets();
    const ws = S.weightSeries(30);
    const filled = ws.filter(x => x.w != null);
    const first = filled.length ? filled[0].w : p.weight;
    const last = filled.length ? filled[filled.length - 1].w : p.weight;
    const change = S.round(last - first, 1);
    const toGo = S.round(last - p.targetWeight, 1);
    const pctGoal = Math.abs(first - p.targetWeight) > 0
      ? Math.min(1, Math.abs(first - last) / Math.abs(first - p.targetWeight)) : 0;

    const avgKcal = (() => {
      let s = 0, n = 0;
      for (let i = 0; i < 7; i++) { const v = S.dayTotals(S.dayOffset(S.todayKey(), -i)).kcal; if (v) { s += v; n++; } }
      return n ? Math.round(s / n) : 0;
    })();

    return `
    <div style="display:flex;align-items:center;gap:13px;margin:10px 4px 0">
      <div class="avatar">${esc((p.name || 'N')[0])}</div>
      <div style="flex:1">
        <div style="font-size:19px;font-weight:800">${esc(p.name)}</div>
        <div class="tiny muted" style="margin-top:3px">${p.sex === 'male' ? '男' : '女'} · ${p.age}岁 · ${p.height}cm · ${last}kg</div>
      </div>
      <button class="round-btn" data-act="settings">${ICON.edit}</button>
    </div>

    <div class="sec-title"><span class="dot"></span>体重趋势<span class="more">近 30 天</span></div>
    <div class="card">
      <div style="display:flex;align-items:flex-end;gap:12px;margin-bottom:10px">
        <div>
          <div style="font-size:34px;font-weight:800;letter-spacing:-1.6px;line-height:1">${last.toFixed(1)}<span style="font-size:13px;color:var(--t3)"> kg</span></div>
          <div class="tiny" style="margin-top:5px;font-weight:700;color:${change <= 0 ? 'var(--green)' : 'var(--orange)'}">
            ${change <= 0 ? '↓' : '↑'} ${Math.abs(change)} kg / 30天
          </div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div class="tiny muted" style="font-weight:700">目标</div>
          <div style="font-size:16px;font-weight:800">${p.targetWeight} kg</div>
          <div class="tiny muted" style="margin-top:3px">还差 ${Math.abs(toGo)} kg</div>
        </div>
      </div>
      ${C.line({ w: 300, h: 96, points: ws, minPad: .6 })}
      <div class="prog" style="margin-top:12px"><i style="width:${pctGoal * 100}%"></i></div>
      <div class="tiny muted center" style="margin-top:7px">目标进度 ${Math.round(pctGoal * 100)}%</div>
    </div>

    <div class="grid2" style="margin-top:11px">
      <div class="mini"><div class="h"><span>基础代谢</span></div>
        <div class="big">${t.bmr}<span>kcal</span></div><div class="foot">Mifflin-St Jeor</div></div>
      <div class="mini"><div class="h"><span>每日消耗</span></div>
        <div class="big">${t.tdee}<span>kcal</span></div><div class="foot">活动系数 ${p.activity}</div></div>
      <div class="mini"><div class="h"><span>日均摄入</span></div>
        <div class="big">${avgKcal}<span>kcal</span></div><div class="foot">近 7 天平均</div></div>
      <div class="mini"><div class="h"><span>目标速率</span></div>
        <div class="big">${p.goalRate > 0 ? '+' : ''}${p.goalRate}<span>kg/周</span></div><div class="foot">日缺口 ${Math.abs(t.delta)} kcal</div></div>
    </div>

    <div class="sec-title"><span class="dot"></span>周摄入<span class="more">近 7 天</span></div>
    <div class="card">
      ${C.bars({ w: 300, h: 110, data: weekKcal(), goal: t.kcal, labels: weekLabels() })}
    </div>

    <div class="sec-title"><span class="dot"></span>成就<span class="more">${S.state.achievements.length}/${D.ACHIEVEMENTS.length}</span></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:9px">
      ${D.ACHIEVEMENTS.map(a => {
        const got = S.state.achievements.includes(a.id);
        return `<div style="text-align:center;padding:12px 4px;border-radius:16px;
          background:${got ? 'rgba(255,59,48,.12)' : 'rgba(255,255,255,.04)'};
          border:1px solid ${got ? 'rgba(255,59,48,.3)' : 'rgba(255,255,255,.06)'};
          opacity:${got ? 1 : .42}">
          <div style="font-size:21px;line-height:1">${a.icon}</div>
          <div style="font-size:9.5px;font-weight:700;margin-top:5px;color:var(--t2)">${a.name}</div>
        </div>`;
      }).join('')}
    </div>

    <div class="sec-title"><span class="dot"></span>更多</div>
    <div class="card" style="padding:4px 16px">
      <div class="kv" data-act="settings"><span class="k">个人设置与目标</span><span class="v">${ICON.arrow}</span></div>
      <div class="kv" data-act="export"><span class="k">导出数据</span><span class="v">${ICON.arrow}</span></div>
      <div class="kv" data-act="import"><span class="k">导入数据</span><span class="v">${ICON.arrow}</span></div>
      <div class="kv" data-act="reset"><span class="k" style="color:var(--red)">清空全部数据</span><span class="v">${ICON.arrow}</span></div>
    </div>

    <div style="height:8px"></div>`;
  };

  global.NorgViews = {
    get tab() { return curTab; },
    set tab(v) { curTab = v; },
    get mode() { return mode; },
    set mode(v) { mode = v; },
    get viewDate() { return viewDate; },
    set viewDate(v) { viewDate = v; },
    get planSub() { return planSub; },
    set planSub(v) { planSub = v; },
    V, weekKcal, weekLabels, macroBar,
  };
})(window);
