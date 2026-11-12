/* ============================================================
   Norg · 计划视图
   ------------------------------------------------------------
   把 planner.js 的推导结果变成可看、可执行的界面：
   - 本周训练安排（哪天练什么、每个动作几组多重）
   - 计划质量审计（肌群组数是否落在 MEV-MRV 区间）
   - 饮食计划（按目标反算的一周菜单）
   - 有氧安排
   - 进度复盘（实际 vs 计划，给出加减量建议）
   ============================================================ */
(function (global) {
  'use strict';

  const S = global.NorgStore;
  const P = global.NorgPlanner;
  const C = global.NorgChart;
  const U = global.NorgUI;
  const D = global.NORG_DATA;
  const esc = U.esc, ICON = U.ICON;

  const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

  /* 当前计划（存在 localStorage 里，随 store 一起持久化） */
  function getWeek() {
    const st = S.state;
    if (!st.planWeek) {
      st.planWeek = P.buildWeek({
        daysPerWeek: st.profile.daysPerWeek || 3,
        equipment: st.profile.equipment || 'all',
        level: st.profile.level || 'intermediate',
      });
      S.save();
    }
    return st.planWeek;
  }

  function regenWeek(opts) {
    const st = S.state;
    st.planWeek = P.buildWeek(Object.assign({
      daysPerWeek: st.profile.daysPerWeek || 3,
      equipment: st.profile.equipment || 'all',
      level: st.profile.level || 'intermediate',
    }, opts || {}));
    S.save();
    return st.planWeek;
  }

  /* ==========================================================
     计划主页
     ========================================================== */
  const V = {};

  V.plan = function () {
    const week = getWeek();
    const audit = P.auditWeek(week);
    const review = P.progressReview();
    const t = S.calcTargets();
    const p = S.state.profile;
    const todayWd = new Date().getDay();

    const todaySession = week.sessions.find(s => s.weekday === todayWd);
    const nextSession = (() => {
      for (let i = 1; i <= 7; i++) {
        const wd = (todayWd + i) % 7;
        const s = week.sessions.find(x => x.weekday === wd);
        if (s) return { session: s, inDays: i };
      }
      return null;
    })();

    return `
    <!-- 今日任务 -->
    <div class="sec-title" style="margin-top:8px"><span class="dot"></span>今天该练什么</div>
    ${todaySession ? todayCard(todaySession, week) : restCard(nextSession)}

    <!-- 计划概览 -->
    <div class="sec-title"><span class="dot"></span>本周计划
      <span class="more" data-act="planSettings">调整</span>
    </div>
    <div class="card glow">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="flex:1">
          <div style="font-size:16px;font-weight:800">${esc(week.splitName)}</div>
          <div class="tiny muted" style="margin-top:4px;line-height:1.5">${esc(week.splitDesc)}</div>
        </div>
        <div style="text-align:center;flex:0 0 auto">
          ${C.progressRing({
            size: 62, stroke: 7,
            pct: audit.score / 100,
            label: String(audit.score),
            sub: '分',
            color: audit.score >= 80 ? 'var(--green)' : audit.score >= 60 ? 'var(--orange)' : 'var(--red)',
          })}
        </div>
      </div>

      <div style="margin-top:14px;display:flex;flex-direction:column;gap:7px">
        ${week.sessions.map(s => {
          const isToday = s.weekday === todayWd;
          return `<div data-session="${s.key}" style="display:flex;align-items:center;gap:10px;padding:10px 11px;border-radius:13px;
            background:${isToday ? 'rgba(255,59,48,.13)' : 'rgba(255,255,255,.04)'};
            border:1px solid ${isToday ? 'rgba(255,59,48,.32)' : 'rgba(255,255,255,.06)'}">
            <span style="width:26px;height:26px;border-radius:9px;display:grid;place-items:center;
              background:${isToday ? 'var(--red)' : 'rgba(255,255,255,.08)'};
              font-size:11.5px;font-weight:800;color:${isToday ? '#fff' : 'var(--t3)'};flex:0 0 auto">
              周${WEEKDAY[s.weekday]}
            </span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13.5px;font-weight:800">${esc(s.label)}</div>
              <div class="tiny muted" style="margin-top:2px">${s.exercises.length} 个动作 · ${s.totalSets} 组</div>
            </div>
            <span style="color:var(--t4);flex:0 0 auto">${ICON.arrow}</span>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- 计划质量审计 -->
    <div class="sec-title"><span class="dot"></span>科学性检查</div>
    <div class="card">
      ${audit.issues.length || audit.warnings.length ? `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${audit.issues.map(i => `<div style="display:flex;gap:8px;font-size:12.5px;line-height:1.55">
            <span style="color:var(--red);flex:0 0 auto">●</span><span style="color:var(--t2)">${esc(i)}</span></div>`).join('')}
          ${audit.warnings.map(w => `<div style="display:flex;gap:8px;font-size:12.5px;line-height:1.55">
            <span style="color:var(--orange);flex:0 0 auto">●</span><span style="color:var(--t3)">${esc(w)}</span></div>`).join('')}
        </div>
      ` : `<div style="display:flex;gap:9px;align-items:center">
          <span style="color:var(--green);font-size:17px">✓</span>
          <span style="font-size:13px;font-weight:700;color:var(--t2)">各肌群训练量都在合理区间内</span>
        </div>`}

      <div style="margin-top:16px">
        <div class="tiny muted" style="font-weight:700;margin-bottom:9px">每周肌群组数 vs 有效区间</div>
        ${volumeBars(audit.volume)}
      </div>
      <div class="tiny muted" style="margin-top:10px;line-height:1.6">
        MEV = 最低有效量，MAV = 最佳适应量，MRV = 可恢复上限。
        绿色区间是增肌效率最高的范围。
      </div>
    </div>

    <!-- 饮食计划 -->
    <div class="sec-title"><span class="dot"></span>饮食安排
      <span class="more" data-act="mealPlan">查看菜单</span>
    </div>
    <div class="card">
      <div style="display:flex;gap:12px">
        <div style="flex:1">
          <div class="tiny muted" style="font-weight:700">每日目标</div>
          <div style="font-size:26px;font-weight:800;letter-spacing:-1.2px;line-height:1.2">${t.kcal}<span style="font-size:12px;color:var(--t3)"> kcal</span></div>
          <div class="tiny muted" style="margin-top:4px">TDEE ${t.tdee} · 日缺口 ${Math.abs(t.delta)}</div>
        </div>
        <div style="display:flex;gap:13px;text-align:right">
          <div><div class="tiny muted">蛋白</div><div style="font-size:16px;font-weight:800;color:var(--purple)">${t.protein}g</div></div>
          <div><div class="tiny muted">碳水</div><div style="font-size:16px;font-weight:800;color:var(--green)">${t.carb}g</div></div>
          <div><div class="tiny muted">脂肪</div><div style="font-size:16px;font-weight:800;color:var(--yellow)">${t.fat}g</div></div>
        </div>
      </div>
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
        <div style="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--t2);font-weight:600">
          <span style="color:var(--green)">▸</span>
          <span>蛋白 ${p.proteinPerKg} g/kg 体重，减脂期足够保肌</span>
        </div>
      </div>
    </div>

    <!-- 有氧 -->
    <div class="sec-title"><span class="dot"></span>有氧安排</div>
    ${cardioCard(p)}

    <!-- 进度复盘 -->
    <div class="sec-title"><span class="dot"></span>进度复盘<span class="more">近 2 周</span></div>
    ${reviewCard(review, week)}

    <div style="height:8px"></div>`;
  };

  /* ---------- 今日训练卡 ---------- */
  function todayCard(s, week) {
    const done = S.day(S.todayKey()).workouts.length > 0;
    return `<div class="card glow" style="margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="flex:1">
          <div style="font-size:18px;font-weight:800;letter-spacing:-.4px">${esc(s.label)}</div>
          <div class="tiny muted" style="margin-top:4px">${s.exercises.length} 个动作 · ${s.totalSets} 组 · 预计 ${Math.round(s.totalSets * 3)} 分钟</div>
        </div>
        ${done ? `<span class="tag red">已完成</span>` : `<span class="tag">待训练</span>`}
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        ${s.exercises.map((e, i) => {
          const meta = D.EXERCISES.find(x => x.id === e.exId);
          return `<div style="display:flex;align-items:center;gap:9px;padding:9px 10px;border-radius:12px;background:rgba(255,255,255,.045)">
            <span style="width:19px;height:19px;border-radius:6px;background:rgba(255,59,48,.18);color:#ff8b82;
              font-size:10px;font-weight:800;display:grid;place-items:center;flex:0 0 auto">${i + 1}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.name)}</div>
              <div class="tiny muted" style="margin-top:2px">${e.targetSets} 组 × ${e.targetReps} 次 · 休息 ${e.rest}</div>
            </div>
            <div style="text-align:right;flex:0 0 auto">
              <div style="font-size:14px;font-weight:800">${e.targetWeight > 0 ? e.targetWeight + '<span style="font-size:9.5px;color:var(--t3)"> kg</span>' : '自重'}</div>
              <div class="tiny" style="color:${e.hasPR ? 'var(--green)' : 'var(--t4)'};margin-top:1px">${e.hasPR ? '按 PR 推算' : '估算'}</div>
            </div>
          </div>`;
        }).join('')}
      </div>

      <button class="btn" style="margin-top:14px" data-act="startFromPlan">按计划开始训练</button>
    </div>`;
  }

  function restCard(next) {
    return `<div class="card" style="margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:30px">🛌</div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:800">今天是休息日</div>
          <div class="tiny muted" style="margin-top:4px;line-height:1.55">
            ${next ? `下次训练：周${WEEKDAY[next.session.weekday]} ${esc(next.session.label)}（${next.inDays} 天后）` : '本周无安排'}
          </div>
        </div>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:12px;color:var(--t3);line-height:1.6">
        休息日建议：散步 6000 步、拉伸 10 分钟、保证 7.5 小时睡眠。肌肉在休息时生长，不是在训练时。
      </div>
    </div>`;
  }

  /* ---------- 肌群组数柱状（带 MEV/MAV/MRV 区间） ---------- */
  function volumeBars(vol) {
    const keys = ['chest', 'back', 'shoulders', 'quads', 'hams', 'glutes', 'biceps', 'triceps', 'abs', 'calves'];
    return `<div style="display:flex;flex-direction:column;gap:8px">
      ${keys.map(k => {
        const lm = P.SCIENCE.volumeLandmark[k];
        const v = Math.round(vol[k] || 0);
        const max = Math.max(lm.mrv, v);
        const pctOf = x => Math.min(100, (x / max) * 100);
        const inRange = v >= lm.mev && v <= lm.mrv;
        const color = v === 0 ? 'var(--t4)' : inRange ? 'var(--green)' : v < lm.mev ? 'var(--orange)' : 'var(--red)';
        return `<div style="display:flex;align-items:center;gap:8px">
          <span style="width:44px;font-size:10.5px;font-weight:700;color:var(--t3);flex:0 0 auto">${D.MUSCLES[k].name}</span>
          <div style="flex:1;height:15px;border-radius:99px;background:rgba(255,255,255,.055);position:relative;overflow:hidden">
            <div style="position:absolute;left:${pctOf(lm.mev)}%;width:${pctOf(lm.mrv) - pctOf(lm.mev)}%;top:0;bottom:0;background:rgba(61,220,132,.13)"></div>
            <div style="position:absolute;left:0;top:0;bottom:0;width:${pctOf(v)}%;border-radius:99px;background:${color};opacity:.88"></div>
          </div>
          <span style="width:30px;text-align:right;font-size:11px;font-weight:800;color:${color};flex:0 0 auto">${v}</span>
        </div>`;
      }).join('')}
    </div>`;
  }

  /* ---------- 有氧卡 ---------- */
  function cardioCard(p) {
    const cp = P.cardioPlan(p.goalType, p.daysPerWeek || 3);
    return `<div class="card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="flex:1">
          <div style="font-size:14.5px;font-weight:800">${esc(cp.type)}</div>
          <div class="tiny muted" style="margin-top:3px">每周 ${cp.sessions} 次 · 每次 ${cp.duration}</div>
        </div>
        <span class="tag red">${esc(cp.hr)}</span>
      </div>
      <div class="tiny" style="color:var(--t3);line-height:1.65">${esc(cp.note)}</div>
    </div>`;
  }

  /* ---------- 复盘卡 ---------- */
  function reviewCard(review, week) {
    const plannedSessions = week.daysPerWeek;
    const actual = review.sessionsPerWeek;
    const rate = plannedSessions ? Math.round(actual / plannedSessions * 100) : 0;

    return `<div class="card">
      <div style="display:flex;gap:14px;margin-bottom:14px">
        <div>
          <div class="tiny muted">周均完成</div>
          <div style="font-size:24px;font-weight:800;letter-spacing:-1px;line-height:1.2">${actual}<span style="font-size:11px;color:var(--t3)"> / ${plannedSessions} 次</span></div>
          <div class="tiny" style="margin-top:3px;color:${rate >= 80 ? 'var(--green)' : rate >= 50 ? 'var(--orange)' : 'var(--red)'};font-weight:700">完成率 ${rate}%</div>
        </div>
        <div style="margin-left:auto;text-align:right">
          <div class="tiny muted">体重变化</div>
          <div style="font-size:14px;font-weight:700;margin-top:5px;line-height:1.5;max-width:190px;color:var(--t2)">
            ${review.weightAdvice ? esc(review.weightAdvice) : '数据不足，再记录几天'}
          </div>
        </div>
      </div>

      ${review.suggestions.length ? `
        <div style="padding-top:12px;border-top:1px solid var(--line)">
          <div class="tiny muted" style="font-weight:700;margin-bottom:9px">调整建议</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${review.suggestions.map(s => `<div style="display:flex;gap:8px;font-size:12px;line-height:1.55">
              <span style="color:${s.type === 'increase' ? 'var(--green)' : 'var(--red)'};flex:0 0 auto">${s.type === 'increase' ? '↑' : '↓'}</span>
              <span style="color:var(--t2)">${esc(s.text)}</span>
            </div>`).join('')}
          </div>
        </div>` : `
        <div style="padding-top:12px;border-top:1px solid var(--line);font-size:12px;color:var(--t3);line-height:1.6">
          各肌群训练量正常，暂无调整建议。继续保持渐进超负荷。
        </div>`}
    </div>`;
  }

  /* ==========================================================
     训练日详情
     ========================================================== */
  V.planSession = function (key) {
    const week = getWeek();
    const s = week.sessions.find(x => x.key === key);
    if (!s) return '<div class="empty">没有这个训练日</div>';

    return `
    <div style="display:flex;align-items:center;gap:9px;margin:8px 4px 0">
      <button class="round-btn" data-act="backPlan" style="width:34px;height:34px;flex:0 0 auto">${ICON.back}</button>
      <div style="font-size:22px;font-weight:800;letter-spacing:-.6px">${esc(s.label)}</div>
      <span class="tag" style="margin-left:auto">周${WEEKDAY[s.weekday]}</span>
    </div>

    <div class="card" style="margin-top:12px">
      <div style="display:flex;gap:16px">
        <div><div class="tiny muted">动作</div><div style="font-size:20px;font-weight:800">${s.exercises.length}</div></div>
        <div><div class="tiny muted">总组数</div><div style="font-size:20px;font-weight:800">${s.totalSets}</div></div>
        <div><div class="tiny muted">预计时长</div><div style="font-size:20px;font-weight:800">${Math.round(s.totalSets * 3)}<span style="font-size:11px;color:var(--t3)"> 分</span></div></div>
      </div>
    </div>

    <div class="sec-title"><span class="dot"></span>动作安排</div>
    <div style="display:flex;flex-direction:column;gap:9px">
      ${s.exercises.map((e, i) => {
        const meta = D.EXERCISES.find(x => x.id === e.exId);
        return `<div class="card" style="padding:13px 15px" data-planex="${e.exId}">
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:9px">
            <span style="width:21px;height:21px;border-radius:7px;background:rgba(255,59,48,.18);color:#ff8b82;
              font-size:10.5px;font-weight:800;display:grid;place-items:center;flex:0 0 auto">${i + 1}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:800">${esc(e.name)}</div>
              <div class="tiny muted" style="margin-top:2px">${meta ? D.MUSCLES[meta.primary].name : ''} · ${meta ? meta.equip : ''}</div>
            </div>
            <span class="tag ${e.intensity === 'strength' ? 'red' : ''}" style="font-size:10px">
              ${e.intensity === 'strength' ? '力量' : '增肌'}
            </span>
          </div>
          <div style="display:flex;gap:10px;padding:9px 11px;border-radius:11px;background:rgba(255,255,255,.045)">
            <div style="flex:1;text-align:center">
              <div class="tiny muted">组数</div>
              <div style="font-size:16px;font-weight:800">${e.targetSets}</div>
            </div>
            <div style="flex:1;text-align:center;border-left:1px solid var(--line);border-right:1px solid var(--line)">
              <div class="tiny muted">次数</div>
              <div style="font-size:16px;font-weight:800">${e.targetReps}</div>
            </div>
            <div style="flex:1;text-align:center">
              <div class="tiny muted">重量</div>
              <div style="font-size:16px;font-weight:800">${e.targetWeight > 0 ? e.targetWeight : '自重'}</div>
            </div>
          </div>
          <div class="tiny muted" style="margin-top:8px;text-align:center">
            休息 ${e.rest}${e.hasPR ? ' · 按你的个人纪录推算' : ' · 无历史数据，按体重估算'}
          </div>
        </div>`;
      }).join('')}
    </div>

    <button class="btn" style="margin-top:16px" data-act="startSession" data-key="${s.key}">开始这个训练日</button>
    <div style="height:8px"></div>`;
  };

  /* ==========================================================
     饮食菜单
     ========================================================== */
  V.planMeal = function () {
    const mp = P.buildMealPlan({ days: 7 });
    const p = S.state.profile;

    return `
    <div style="display:flex;align-items:center;gap:9px;margin:8px 4px 0">
      <button class="round-btn" data-act="backPlan" style="width:34px;height:34px;flex:0 0 auto">${ICON.back}</button>
      <div style="font-size:22px;font-weight:800;letter-spacing:-.6px">一周菜单</div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="tiny muted" style="font-weight:700;margin-bottom:8px">按你的目标自动配比</div>
      <div style="display:flex;gap:14px">
        <div><div class="tiny muted">热量</div><div style="font-size:19px;font-weight:800">${mp.target.kcal}</div></div>
        <div><div class="tiny muted">蛋白</div><div style="font-size:19px;font-weight:800;color:var(--purple)">${mp.target.protein}g</div></div>
        <div><div class="tiny muted">碳水</div><div style="font-size:19px;font-weight:800;color:var(--green)">${mp.target.carb}g</div></div>
        <div><div class="tiny muted">脂肪</div><div style="font-size:19px;font-weight:800;color:var(--yellow)">${mp.target.fat}g</div></div>
      </div>
    </div>

    <div class="sec-title"><span class="dot"></span>七天安排</div>
    ${mp.days.map(d => {
      const diff = d.total.kcal - d.target.kcal;
      const ok = Math.abs(diff) < 120;
      return `<div class="card" style="margin-bottom:10px;padding:13px 15px">
        <div style="display:flex;align-items:center;margin-bottom:10px">
          <span style="font-size:13px;font-weight:800">第 ${d.day + 1} 天</span>
          <span class="tag" style="margin-left:auto;font-size:10px;${ok ? '' : 'color:var(--orange);border-color:rgba(255,159,67,.35)'}">
            ${d.total.kcal} kcal ${ok ? '✓' : `(${diff > 0 ? '+' : ''}${diff})`}
          </span>
        </div>
        ${d.meals.map(m => `
          <div style="margin-bottom:9px">
            <div class="tiny muted" style="font-weight:700;margin-bottom:5px">${m.slot}</div>
            ${m.items.map(it => `
              <div style="display:flex;font-size:12px;font-weight:600;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.035)">
                <span style="color:var(--t2)">${esc(it.name)}</span>
                <span style="margin-left:auto;color:var(--t3)">${it.grams}g · ${it.kcal} kcal</span>
              </div>`).join('')}
          </div>`).join('')}
        <div style="display:flex;gap:12px;margin-top:8px;padding-top:8px;border-top:1px solid var(--line)">
          <span class="tiny" style="color:var(--purple);font-weight:700">P ${d.total.p}g</span>
          <span class="tiny" style="color:var(--green);font-weight:700">C ${d.total.c}g</span>
          <span class="tiny" style="color:var(--yellow);font-weight:700">F ${d.total.f}g</span>
        </div>
      </div>`;
    }).join('')}

    <div class="card" style="margin-top:4px">
      <div class="tiny muted" style="line-height:1.7">
        菜单按你的目标宏量反算克数，允许每天 ±120 kcal 误差。
        实际执行时按「饮食」页记录，App 会自动对比目标。
        食材可以等价替换：鸡胸肉 ↔ 牛里脊 ↔ 虾，米饭 ↔ 糙米饭 ↔ 红薯。
      </div>
    </div>
    <div style="height:8px"></div>`;
  };

  global.NorgPlanViews = { V, getWeek, regenWeek, WEEKDAY };
})(window);
