/* ============================================================
   Norg · 计划视图 v2
   ------------------------------------------------------------
   - 计划库：8 套可选，按水平/器械筛选
   - 分阶段：显示当前第几周、这阶段该注意什么
   - 动作教学：难度标签 + 新手替代 + 关键提示
   ============================================================ */
(function (global) {
  'use strict';

  const S = global.NorgStore;
  const P = global.NorgPrograms;
  const C = global.NorgChart;
  const U = global.NorgUI;
  const D = global.NORG_DATA;
  const esc = U.esc, ICON = U.ICON;

  const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];

  /* 取当前计划状态（存在 store 里） */
  function getState() {
    const st = S.state;
    if (!st.program) {
      st.program = { id: 'starter4w', startDate: S.todayKey(), weekIndex: 1 };
      S.save();
    }
    return st.program;
  }

  function currentProgram() {
    const p = getState();
    return P.PROGRAMS.find(x => x.id === p.id) || P.PROGRAMS[0];
  }

  function currentWeek() {
    const st = getState();
    const prog = currentProgram();
    return P.buildWeek(prog.id, st.weekIndex);
  }

  /* 计算已进行到第几周（按开始日期推算） */
  function autoWeekIndex() {
    const st = getState();
    if (!st.startDate) return 1;
    const start = new Date(st.startDate + 'T00:00:00');
    const now = new Date(S.todayKey() + 'T00:00:00');
    const days = Math.floor((now - start) / 86400000);
    const w = Math.floor(days / 7) + 1;
    return Math.max(1, Math.min(currentProgram().weeks, w));
  }

  function switchProgram(id) {
    const st = S.state;
    st.program = { id, startDate: S.todayKey(), weekIndex: 1 };
    S.save();
  }

  /* ==========================================================
     计划主页
     ========================================================== */
  const V = {};

  V.plan = function () {
    const st = getState();
    const prog = currentProgram();
    const weekIdx = autoWeekIndex();
    const week = P.buildWeek(prog.id, weekIdx);
    const phase = P.phaseOf(prog, weekIdx);
    const audit = P.auditWeek(week);
    const todayWd = new Date().getDay();
    const todaySession = week.sessions.find(s => s.weekday === todayWd);
    const nextSession = (() => {
      for (let i = 1; i <= 7; i++) {
        const wd = (todayWd + i) % 7;
        const s = week.sessions.find(x => x.weekday === wd);
        if (s) return { s, inDays: i };
      }
      return null;
    })();

    const progress = Math.min(100, Math.round(weekIdx / prog.weeks * 100));

    return `
    <!-- 当前计划卡 -->
    <div class="sec-title" style="margin-top:8px"><span class="dot"></span>我的计划
      <span class="more" data-act="openLibrary">换计划</span>
    </div>

    <div class="card glow" style="padding:18px">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap">
            <span style="font-size:18px;font-weight:800;letter-spacing:-.4px">${esc(prog.name)}</span>
            <span class="tag red" style="font-size:10px">${esc(prog.badge)}</span>
          </div>
          <div class="tiny muted" style="margin-top:6px;line-height:1.55">${esc(prog.desc)}</div>
        </div>
      </div>

      <!-- 进度 -->
      <div style="margin-top:16px">
        <div style="display:flex;justify-content:space-between;font-size:11.5px;font-weight:700;margin-bottom:6px">
          <span style="color:var(--t2)">第 ${weekIdx} 周 / 共 ${prog.weeks} 周</span>
          <span style="color:var(--t3)">${progress}%</span>
        </div>
        <div class="prog"><i style="width:${progress}%"></i></div>
      </div>

      <!-- 当前阶段 -->
      ${phase ? `
      <div style="margin-top:14px;padding:12px 13px;border-radius:14px;
           background:rgba(255,59,48,.10);border:1px solid rgba(255,59,48,.22)">
        <div style="display:flex;align-items:center;gap:7px">
          <span style="font-size:13px;font-weight:800;color:#ff8b82">${esc(phase.name)}</span>
          <span class="tag" style="font-size:9.5px;margin-left:auto">强度 RPE ${esc(phase.rpe)}</span>
        </div>
        <div class="tiny" style="margin-top:7px;line-height:1.65;color:var(--t2)">${esc(phase.note)}</div>
      </div>` : ''}

      <!-- 周次切换 -->
      <div style="margin-top:14px;display:flex;gap:6px;overflow-x:auto;padding-bottom:2px">
        ${Array.from({ length: prog.weeks }, (_, i) => i + 1).map(w => {
          const on = w === weekIdx;
          const ph = P.phaseOf(prog, w);
          return `<button class="tag ${on ? 'red' : ''}" data-week="${w}"
            style="white-space:nowrap;font-size:10.5px">第${w}周${ph ? ' · ' + ph.name.split('·')[0].trim() : ''}</button>`;
        }).join('')}
      </div>
    </div>

    <!-- 今日任务 -->
    <div class="sec-title"><span class="dot"></span>今天该练什么</div>
    ${todaySession ? todayCard(todaySession, week, phase) : restCard(nextSession, week)}

    <!-- 本周安排 -->
    <div class="sec-title"><span class="dot"></span>本周安排<span class="more">共 ${week.sessions.length} 练</span></div>
    <div style="display:flex;flex-direction:column;gap:8px">
      ${week.sessions.map(s => {
        const isToday = s.weekday === todayWd;
        const hardCount = s.exercises.filter(e => e.difficulty === 3).length;
        return `<div class="card" data-session="${s.key}" style="padding:13px 15px;
          background:${isToday ? 'linear-gradient(168deg,rgba(255,59,48,.16),rgba(255,59,48,.06))' : ''};
          border-color:${isToday ? 'rgba(255,59,48,.32)' : ''}">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="width:30px;height:30px;border-radius:10px;display:grid;place-items:center;
              background:${isToday ? 'var(--red)' : 'rgba(255,255,255,.07)'};
              font-size:11.5px;font-weight:800;color:${isToday ? '#fff' : 'var(--t3)'};flex:0 0 auto">
              周${WEEKDAY[s.weekday]}
            </span>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:800">${esc(s.label)}</div>
              <div class="tiny muted" style="margin-top:2px">
                ${s.exercises.length} 个动作 · ${s.totalSets} 组${hardCount ? ` · ${hardCount} 个较难` : ''}
              </div>
            </div>
            <span style="color:var(--t4);flex:0 0 auto">${ICON.arrow}</span>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- 检查 -->
    ${audit.warnings.length ? `
      <div class="sec-title"><span class="dot"></span>提醒</div>
      <div class="card">
        ${audit.warnings.map(w => `<div style="display:flex;gap:8px;font-size:12px;line-height:1.6;margin-bottom:6px">
          <span style="color:var(--orange);flex:0 0 auto">●</span><span style="color:var(--t2)">${esc(w)}</span></div>`).join('')}
      </div>` : ''}

    <!-- 有氧 + 复盘 -->
    <div class="sec-title"><span class="dot"></span>有氧建议</div>
    ${cardioCard()}

    <div class="sec-title"><span class="dot"></span>进度复盘<span class="more">近 2 周</span></div>
    ${reviewCard()}

    <div style="height:8px"></div>`;
  };

  /* ---------- 今日训练卡 ---------- */
  function todayCard(s, week, phase) {
    const done = S.day(S.todayKey()).workouts.length > 0;
    const mins = Math.round(s.totalSets * 3);

    return `<div class="card glow" style="margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <div style="flex:1">
          <div style="font-size:18px;font-weight:800;letter-spacing:-.4px">${esc(s.label)}</div>
          <div class="tiny muted" style="margin-top:4px">${s.exercises.length} 个动作 · ${s.totalSets} 组 · 约 ${mins} 分钟</div>
        </div>
        ${done ? `<span class="tag red">已完成</span>` : `<span class="tag">待训练</span>`}
      </div>

      <div style="display:flex;flex-direction:column;gap:8px">
        ${s.exercises.map((e, i) => {
          const dc = P.diffColor(e.difficulty);
          return `<div data-planex="${e.exId}" style="padding:10px 11px;border-radius:13px;background:rgba(255,255,255,.045)">
            <div style="display:flex;align-items:center;gap:9px">
              <span style="width:19px;height:19px;border-radius:6px;background:rgba(255,59,48,.18);color:#ff8b82;
                font-size:10px;font-weight:800;display:grid;place-items:center;flex:0 0 auto">${i + 1}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px">
                  <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.name)}</span>
                  <span style="font-size:9px;font-weight:800;color:${dc};flex:0 0 auto">${P.diffLabel(e.difficulty)}</span>
                </div>
                <div class="tiny muted" style="margin-top:2px">${e.targetSets} 组 × ${e.targetReps}${typeof e.targetReps === 'number' ? ' 次' : ''} · 休息 ${e.rest}</div>
              </div>
              <div style="text-align:right;flex:0 0 auto">
                <div style="font-size:13.5px;font-weight:800">${e.targetWeight > 0 ? e.targetWeight + '<span style="font-size:9px;color:var(--t3)">kg</span>' : '自重'}</div>
              </div>
            </div>
            ${e.alt && e.difficulty >= 2 ? `
              <div class="tiny" style="margin-top:7px;padding-top:7px;border-top:1px solid rgba(255,255,255,.06);
                   color:var(--t3);line-height:1.5">
                <span style="color:var(--orange)">不会做？</span> 换成 ${esc(e.alt)}
              </div>` : ''}
          </div>`;
        }).join('')}
      </div>

      <button class="btn" style="margin-top:14px" data-act="startFromPlan">按计划开始训练</button>
      <div class="tiny muted center" style="margin-top:8px;line-height:1.5">
        点任意动作可以看 3D 示范和分步要领
      </div>
    </div>`;
  }

  function restCard(next, week) {
    return `<div class="card" style="margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="font-size:30px">🛌</div>
        <div style="flex:1">
          <div style="font-size:15px;font-weight:800">今天是休息日</div>
          <div class="tiny muted" style="margin-top:4px;line-height:1.55">
            ${next ? `下次：周${WEEKDAY[next.s.weekday]} ${esc(next.s.label)}（${next.inDays} 天后）` : '本周无安排'}
          </div>
        </div>
      </div>
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line);
           font-size:12px;color:var(--t3);line-height:1.65">
        休息日建议：散步 6000 步、拉伸 10 分钟、保证 7.5 小时睡眠。<br>
        肌肉是在休息时长的，不是在训练时。
      </div>
    </div>`;
  }

  /* ---------- 有氧 ---------- */
  function cardioCard() {
    const p = S.state.profile;
    const prog = currentProgram();
    const isBeginner = prog.level === 'beginner';

    const info = p.goalType === 'cut'
      ? {
          n: isBeginner ? 2 : 3,
          type: '快走 / 慢跑（Zone 2）',
          dur: isBeginner ? '20-30 分钟' : '30-45 分钟',
          hr: '最大心率 60-70%',
          note: isBeginner
            ? '新手先别急着跑步。快走就够，重点是能坚持。每周 2 次，安排在非训练日。'
            : '安排在力量训练之后或非训练日。每周 150-250 分钟。',
        }
      : {
          n: 1,
          type: 'Zone 2 有氧',
          dur: '20 分钟',
          hr: '最大心率 60-65%',
          note: '增肌期有氧只用于维持心肺，不要过量，以免影响能量盈余。',
        };

    return `<div class="card">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="flex:1">
          <div style="font-size:14.5px;font-weight:800">${esc(info.type)}</div>
          <div class="tiny muted" style="margin-top:3px">每周 ${info.n} 次 · 每次 ${info.dur}</div>
        </div>
        <span class="tag red">${esc(info.hr)}</span>
      </div>
      <div class="tiny" style="color:var(--t3);line-height:1.65">${esc(info.note)}</div>
    </div>`;
  }

  /* ---------- 复盘 ---------- */
  function reviewCard() {
    const today = S.todayKey();
    let done = 0;
    for (let i = 0; i < 14; i++) {
      const d = S.state.days[S.dayOffset(today, -i)];
      if (d) done += (d.workouts || []).length;
    }
    const avg = done / 2;
    const prog = currentProgram();
    const rate = Math.round(avg / prog.days * 100);

    // 体重建议
    const ws = S.weightSeries(14).filter(x => x.w != null);
    let advice = '数据不足，再记录几天';
    if (ws.length >= 7) {
      const rate2 = (ws[ws.length - 1].w - ws[0].w) / (ws.length / 7);
      const target = S.state.profile.goalRate;
      if (Math.abs(rate2 - target) > 0.3) {
        advice = rate2 < target
          ? `减重 ${Math.abs(rate2).toFixed(2)} kg/周，慢于目标。每日再减 150 kcal 或加 1 次快走`
          : `变化 ${rate2.toFixed(2)} kg/周，快于目标。每日加 150 kcal，避免掉肌肉`;
      } else {
        advice = `${rate2.toFixed(2)} kg/周，与目标基本吻合，保持`;
      }
    }

    return `<div class="card">
      <div style="display:flex;gap:14px;margin-bottom:12px">
        <div>
          <div class="tiny muted">周均完成</div>
          <div style="font-size:24px;font-weight:800;letter-spacing:-1px;line-height:1.2">
            ${avg.toFixed(1)}<span style="font-size:11px;color:var(--t3)"> / ${prog.days} 次</span>
          </div>
          <div class="tiny" style="margin-top:3px;color:${rate >= 80 ? 'var(--green)' : rate >= 50 ? 'var(--orange)' : 'var(--red)'};font-weight:700">
            完成率 ${rate}%
          </div>
        </div>
        <div style="margin-left:auto;text-align:right;max-width:200px">
          <div class="tiny muted">体重变化</div>
          <div style="font-size:12.5px;font-weight:600;margin-top:5px;line-height:1.55;color:var(--t2)">${esc(advice)}</div>
        </div>
      </div>
      ${rate < 50 ? `
        <div style="padding-top:11px;border-top:1px solid var(--line);font-size:12px;color:var(--t3);line-height:1.6">
          <span style="color:var(--orange)">建议：</span>完成率偏低。新手先把频率稳住，哪怕每次只练 20 分钟也算。
        </div>` : `
        <div style="padding-top:11px;border-top:1px solid var(--line);font-size:12px;color:var(--t3);line-height:1.6">
          保持当前节奏。动作熟练后，每次训练比上次多做 1-2 次或多加 2.5kg。
        </div>`}
    </div>`;
  }

  /* ==========================================================
     计划库
     ========================================================== */
  V.planLibrary = function () {
    const st = getState();
    const cur = currentProgram();

    return `
    <div style="display:flex;align-items:center;gap:9px;margin:8px 4px 0">
      <button class="round-btn" data-act="backPlan" style="width:34px;height:34px;flex:0 0 auto">${ICON.back}</button>
      <div style="font-size:22px;font-weight:800;letter-spacing:-.6px">计划库</div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="tiny muted" style="line-height:1.7">
        选一套适合你的。**新手建议从「新手入门 · 4 周」开始**，先把动作学会再加重量。
        换计划会重新计算起始周，已记录的训练数据不受影响。
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:11px;margin-top:12px">
      ${P.PROGRAMS.map(prog => {
        const isCur = prog.id === cur.id;
        const lv = prog.level === 'beginner' ? '新手' : prog.level === 'advanced' ? '进阶' : '中阶';
        const lvColor = prog.level === 'beginner' ? 'var(--green)' : prog.level === 'advanced' ? 'var(--orange)' : 'var(--cyan)';
        return `<div class="card" data-pickprog="${prog.id}" style="padding:15px;cursor:pointer;
          border-color:${isCur ? 'rgba(255,59,48,.45)' : ''};
          background:${isCur ? 'linear-gradient(168deg,rgba(255,59,48,.13),rgba(255,59,48,.04))' : ''}">
          <div style="display:flex;align-items:flex-start;gap:9px">
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="font-size:15px;font-weight:800">${esc(prog.name)}</span>
                ${isCur ? '<span class="tag red" style="font-size:9px">当前</span>' : ''}
              </div>
              <div class="tiny" style="margin-top:5px;color:var(--t3);line-height:1.55">${esc(prog.desc)}</div>
            </div>
          </div>

          <div style="display:flex;gap:7px;margin-top:11px;flex-wrap:wrap">
            <span class="tag" style="font-size:9.5px;color:${lvColor};border-color:${lvColor}44">${lv}</span>
            <span class="tag" style="font-size:9.5px">每周 ${prog.days} 练</span>
            <span class="tag" style="font-size:9.5px">${prog.weeks} 周</span>
            <span class="tag" style="font-size:9.5px">${esc(prog.equipment === 'all' ? '器械不限' : prog.equipment)}</span>
          </div>

          <div class="tiny" style="margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.06);
               color:var(--t3);line-height:1.55">
            <span style="color:var(--t2);font-weight:700">阶段：</span>
            ${prog.phases.map(p => p.name.split('·')[1] ? p.name.split('·')[1].trim() : p.name).join(' → ')}
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="height:8px"></div>`;
  };

  /* ==========================================================
     训练日详情
     ========================================================== */
  V.planSession = function (key) {
    const st = getState();
    const prog = currentProgram();
    const weekIdx = autoWeekIndex();
    const week = P.buildWeek(prog.id, weekIdx);
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
        <div><div class="tiny muted">预计</div><div style="font-size:20px;font-weight:800">${Math.round(s.totalSets * 3)}<span style="font-size:11px;color:var(--t3)"> 分</span></div></div>
      </div>
      ${week.phaseNote ? `<div class="tiny" style="margin-top:12px;padding-top:11px;border-top:1px solid var(--line);
        color:var(--t3);line-height:1.6">${esc(week.phaseNote)}</div>` : ''}
    </div>

    <div class="sec-title"><span class="dot"></span>动作安排</div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${s.exercises.map((e, i) => {
        const dc = P.diffColor(e.difficulty);
        return `<div class="card" style="padding:14px 15px" data-planex="${e.exId}">
          <div style="display:flex;align-items:center;gap:9px;margin-bottom:10px">
            <span style="width:22px;height:22px;border-radius:7px;background:rgba(255,59,48,.18);color:#ff8b82;
              font-size:10.5px;font-weight:800;display:grid;place-items:center;flex:0 0 auto">${i + 1}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:14.5px;font-weight:800">${esc(e.name)}</div>
              <div class="tiny muted" style="margin-top:2px">${D.MUSCLES[e.muscle] ? D.MUSCLES[e.muscle].name : ''}</div>
            </div>
            <span style="font-size:10px;font-weight:800;color:${dc};flex:0 0 auto">${P.diffLabel(e.difficulty)}</span>
          </div>

          <div style="display:flex;gap:10px;padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.045)">
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

          ${e.tip ? `
            <div class="tiny" style="margin-top:10px;color:var(--t3);line-height:1.6">
              <span style="color:var(--cyan)">要领：</span>${esc(e.tip)}
            </div>` : ''}
          ${e.alt ? `
            <div class="tiny" style="margin-top:6px;color:var(--t3);line-height:1.6">
              <span style="color:var(--orange)">不会做？</span>换成 ${esc(e.alt)}
            </div>` : ''}

          <div style="margin-top:10px;padding-top:9px;border-top:1px solid rgba(255,255,255,.05);
               display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t4);font-weight:600">
            点开看 3D 示范 ${ICON.arrow}
          </div>
        </div>`;
      }).join('')}
    </div>

    <button class="btn" style="margin-top:16px" data-act="startSession" data-key="${s.key}">开始这个训练日</button>
    <div style="height:8px"></div>`;
  };

  /* ==========================================================
     饮食菜单（保留）
     ========================================================== */
  V.planMeal = function () {
    const PL = global.NorgPlanner;
    const mp = PL.buildMealPlan({ days: 7 });
    const t = mp.target;

    return `
    <div style="display:flex;align-items:center;gap:9px;margin:8px 4px 0">
      <button class="round-btn" data-act="backPlan" style="width:34px;height:34px;flex:0 0 auto">${ICON.back}</button>
      <div style="font-size:22px;font-weight:800;letter-spacing:-.6px">一周菜单</div>
    </div>

    <div class="card" style="margin-top:12px">
      <div class="tiny muted" style="font-weight:700;margin-bottom:8px">按你的目标自动配比</div>
      <div style="display:flex;gap:14px">
        <div><div class="tiny muted">热量</div><div style="font-size:19px;font-weight:800">${t.kcal}</div></div>
        <div><div class="tiny muted">蛋白</div><div style="font-size:19px;font-weight:800;color:var(--purple)">${t.protein}g</div></div>
        <div><div class="tiny muted">碳水</div><div style="font-size:19px;font-weight:800;color:var(--green)">${t.carb}g</div></div>
        <div><div class="tiny muted">脂肪</div><div style="font-size:19px;font-weight:800;color:var(--yellow)">${t.fat}g</div></div>
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
        食材可以等价替换：鸡胸肉 ↔ 牛里脊 ↔ 虾，米饭 ↔ 糙米饭 ↔ 红薯。
      </div>
    </div>
    <div style="height:8px"></div>`;
  };

  global.NorgPlanViews = {
    V, getState, currentProgram, currentWeek, autoWeekIndex, switchProgram, WEEKDAY,
    /* 兼容旧接口 */
    getWeek: currentWeek,
    regenWeek: () => { S.save(); return currentWeek(); },
  };
})(window);
