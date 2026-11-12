/* ============================================================
   Norg · SVG 图表引擎（零依赖）
   环形 / 弧线仪表 / 折线 / 柱状 / 人体肌群热力图
   ============================================================ */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const R = global.NorgStore.round;

  /* ---------- 多段环形（宏量） ---------- */
  function ring(opts) {
    const { size = 108, stroke = 11, gap = 7, segments = [], center = '', sub = '' } = opts;
    const cx = size / 2, cy = size / 2;
    const r = (size - stroke) / 2 - 2;
    const C = 2 * Math.PI * r;
    const total = segments.reduce((a, s) => a + s.value, 0) || 1;
    let acc = 0;

    let paths = '';
    segments.forEach(s => {
      const frac = s.value / total;
      const len = Math.max(0, frac * C - gap);
      const dash = `${len} ${C - len}`;
      const rot = -90 + (acc / total) * 360;
      paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${s.color}" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${dash}" transform="rotate(${rot} ${cx} ${cy})"
        style="filter:drop-shadow(0 0 5px ${s.color}66)"/>`;
      acc += s.value;
    });

    return `<svg class="chart" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="${stroke}"/>
      ${paths}
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="#fff"
        font-size="${size * .19}" font-weight="800" letter-spacing="-1">${center}</text>
      <text x="${cx}" y="${cy + size * .13}" text-anchor="middle" fill="rgba(255,255,255,.4)"
        font-size="${size * .085}" font-weight="600">${sub}</text>
    </svg>`;
  }

  /* ---------- 单值进度环 ---------- */
  function progressRing(opts) {
    const { size = 120, stroke = 12, pct = 0, color = '#ff3b30', label = '', sub = '', track = 'rgba(255,255,255,.10)' } = opts;
    const cx = size / 2, cy = size / 2;
    const r = (size - stroke) / 2 - 1;
    const C = 2 * Math.PI * r;
    const v = Math.max(0, Math.min(1, pct));
    const dash = v * C;
    return `<svg class="chart" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${dash.toFixed(1)} ${(C - dash).toFixed(1)}"
        transform="rotate(-90 ${cx} ${cy})"
        style="filter:drop-shadow(0 0 7px ${color}77)"/>
      <text x="${cx}" y="${cy + 2}" text-anchor="middle" fill="#fff"
        font-size="${size * .23}" font-weight="800" letter-spacing="-1">${label}</text>
      <text x="${cx}" y="${cy + size * .17}" text-anchor="middle" fill="rgba(255,255,255,.38)"
        font-size="${size * .092}" font-weight="600">${sub}</text>
    </svg>`;
  }

  /* ---------- 半圆仪表（热量缺口） ---------- */
  function gauge(opts) {
    const { w = 200, h = 118, value = 0, min = -2000, max = 2000, label = '', sub = '', color = '#ff3b30' } = opts;
    const cx = w / 2, cy = h - 12;
    const r = Math.min(w / 2 - 12, h - 26);
    const start = Math.PI, end = 2 * Math.PI;
    const arc = (a1, a2, rr) => {
      const x1 = cx + rr * Math.cos(a1), y1 = cy + rr * Math.sin(a1);
      const x2 = cx + rr * Math.cos(a2), y2 = cy + rr * Math.sin(a2);
      const large = Math.abs(a2 - a1) > Math.PI ? 1 : 0;
      return `M${x1} ${y1} A${rr} ${rr} 0 ${large} 1 ${x2} ${y2}`;
    };
    const frac = (value - min) / (max - min);
    const ang = start + Math.PI * Math.max(0, Math.min(1, frac));

    // 刻度
    let ticks = '';
    for (let i = 0; i <= 8; i++) {
      const a = start + (Math.PI * i) / 8;
      const x1 = cx + (r - 9) * Math.cos(a), y1 = cy + (r - 9) * Math.sin(a);
      const x2 = cx + (r - 2) * Math.cos(a), y2 = cy + (r - 2) * Math.sin(a);
      ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,.2)" stroke-width="1.6" stroke-linecap="round"/>`;
    }

    return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
      <path d="${arc(start, end, r)}" fill="none" stroke="rgba(255,255,255,.07)" stroke-width="11" stroke-linecap="round"/>
      <path d="${arc(start, ang, r)}" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round"
        style="filter:drop-shadow(0 0 9px ${color}aa)"/>
      ${ticks}
      <circle cx="${cx + r * Math.cos(ang)}" cy="${cy + r * Math.sin(ang)}" r="5.5" fill="#fff"/>
      <text x="${cx}" y="${cy - 26}" text-anchor="middle" fill="#fff" font-size="26" font-weight="800" letter-spacing="-1">${label}</text>
      <text x="${cx}" y="${cy - 8}" text-anchor="middle" fill="rgba(255,255,255,.4)" font-size="10.5" font-weight="700">${sub}</text>
    </svg>`;
  }

  /* ---------- 折线（体重趋势） ---------- */
  function line(opts) {
    const { w = 300, h = 74, points = [], color = '#ff3b30', fill = true, dots = true, minPad = 0.8 } = opts;
    const vals = points.map(p => p.w).filter(v => v != null);
    if (!vals.length) {
      return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}">
        <line x1="0" y1="${h - 6}" x2="${w}" y2="${h - 6}" stroke="rgba(255,255,255,.1)" stroke-width="1"/>
      </svg>`;
    }
    const mn = Math.min(...vals) - minPad, mx = Math.max(...vals) + minPad;
    const span = mx - mn || 1;
    const pad = 5;
    const X = i => pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
    const Y = v => h - pad - ((v - mn) / span) * (h - pad * 2);

    let d = '', area = '', started = false, firstX = 0, lastX = 0;
    points.forEach((p, i) => {
      if (p.w == null) return;
      const x = X(i), y = Y(p.w);
      if (!started) { d += `M${x} ${y}`; firstX = x; started = true; }
      else d += ` L${x} ${y}`;
      lastX = x;
    });
    area = `${d} L${lastX} ${h} L${firstX} ${h} Z`;

    let ds = '';
    if (dots) {
      points.forEach((p, i) => {
        if (p.w == null) return;
        ds += `<circle cx="${X(i)}" cy="${Y(p.w)}" r="2.4" fill="${color}"/>`;
      });
      // 最后一个点高亮
      for (let i = points.length - 1; i >= 0; i--) {
        if (points[i].w != null) {
          ds += `<circle cx="${X(i)}" cy="${Y(points[i].w)}" r="4" fill="#fff" stroke="${color}" stroke-width="2.4"/>`;
          break;
        }
      }
    }

    const gid = 'lg' + Math.random().toString(36).slice(2, 6);
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none">
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity=".28"/>
        <stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${fill ? `<path d="${area}" fill="url(#${gid})"/>` : ''}
      <path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      ${ds}
    </svg>`;
  }

  /* ---------- 柱状（周热量） ---------- */
  function bars(opts) {
    const { w = 300, h = 90, data = [], color = '#ff3b30', goal = null, labels = [] } = opts;
    const mx = Math.max(goal || 0, ...data, 1);
    const n = data.length || 1;
    const gap = 7;
    const bw = (w - gap * (n - 1)) / n;
    let out = '';
    data.forEach((v, i) => {
      const bh = Math.max(2, (v / mx) * (h - 20));
      const x = i * (bw + gap);
      const y = h - 16 - bh;
      const over = goal && v > goal * 1.06;
      out += `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="${Math.min(5, bw / 2)}"
        fill="${over ? 'rgba(255,255,255,.28)' : color}" opacity="${v ? .92 : .16}"/>`;
      if (labels[i]) {
        out += `<text x="${x + bw / 2}" y="${h - 3}" text-anchor="middle" fill="rgba(255,255,255,.34)"
          font-size="9" font-weight="700">${labels[i]}</text>`;
      }
    });
    let goalLine = '';
    if (goal) {
      const gy = h - 16 - (goal / mx) * (h - 20);
      goalLine = `<line x1="0" y1="${gy}" x2="${w}" y2="${gy}" stroke="rgba(255,255,255,.3)"
        stroke-width="1" stroke-dasharray="4 4"/>`;
    }
    return `<svg class="chart" viewBox="0 0 ${w} ${h}" width="100%" height="${h}">${goalLine}${out}</svg>`;
  }

  /* ---------- 人体肌群热力图（正面 + 背面） ---------- */
  function bodyMap(opts) {
    const { data = {}, w = 128, h = 200, mode = 'front' } = opts;
    const maxV = Math.max(1, ...Object.values(data));
    const c = m => {
      const v = data[m] || 0;
      if (!v) return 'rgba(255,255,255,.10)';
      const a = 0.28 + 0.72 * (v / maxV);
      return `rgba(255,59,48,${a.toFixed(2)})`;
    };
    const stroke = 'rgba(255,255,255,.16)';

    if (mode === 'front') {
      return `<svg class="chart" viewBox="0 0 128 200" width="${w}" height="${h}">
        <g stroke="${stroke}" stroke-width="1" stroke-linejoin="round">
          <!-- 头 -->
          <circle cx="64" cy="18" r="11" fill="rgba(255,255,255,.08)"/>
          <!-- 颈/斜方 -->
          <path d="M54 30 L74 30 L78 40 L50 40 Z" fill="${c('traps')}"/>
          <!-- 肩 -->
          <ellipse cx="36" cy="52" rx="12" ry="9" fill="${c('shoulders')}"/>
          <ellipse cx="92" cy="52" rx="12" ry="9" fill="${c('shoulders')}"/>
          <!-- 胸 -->
          <path d="M46 42 Q64 40 82 42 L86 62 Q64 72 42 62 Z" fill="${c('chest')}"/>
          <!-- 腹 -->
          <rect x="52" y="64" width="24" height="34" rx="6" fill="${c('abs')}"/>
          <!-- 二头 -->
          <ellipse cx="30" cy="76" rx="8" ry="14" fill="${c('biceps')}"/>
          <ellipse cx="98" cy="76" rx="8" ry="14" fill="${c('biceps')}"/>
          <!-- 前臂 -->
          <ellipse cx="25" cy="106" rx="6.5" ry="15" fill="${c('forearms')}"/>
          <ellipse cx="103" cy="106" rx="6.5" ry="15" fill="${c('forearms')}"/>
          <!-- 股四头 -->
          <path d="M48 102 L62 102 L60 152 L48 152 Z" fill="${c('quads')}"/>
          <path d="M66 102 L80 102 L80 152 L68 152 Z" fill="${c('quads')}"/>
          <!-- 小腿 -->
          <path d="M49 158 L60 158 L58 192 L50 192 Z" fill="${c('calves')}"/>
          <path d="M68 158 L79 158 L78 192 L70 192 Z" fill="${c('calves')}"/>
        </g>
      </svg>`;
    }

    return `<svg class="chart" viewBox="0 0 128 200" width="${w}" height="${h}">
      <g stroke="${stroke}" stroke-width="1" stroke-linejoin="round">
        <circle cx="64" cy="18" r="11" fill="rgba(255,255,255,.08)"/>
        <path d="M54 30 L74 30 L78 42 L50 42 Z" fill="${c('traps')}"/>
        <ellipse cx="36" cy="52" rx="12" ry="9" fill="${c('shoulders')}"/>
        <ellipse cx="92" cy="52" rx="12" ry="9" fill="${c('shoulders')}"/>
        <!-- 背阔 -->
        <path d="M44 44 Q64 42 84 44 L82 78 Q64 86 46 78 Z" fill="${c('back')}"/>
        <!-- 竖脊 -->
        <rect x="58" y="80" width="12" height="20" rx="4" fill="${c('back')}" opacity=".7"/>
        <!-- 三头 -->
        <ellipse cx="30" cy="78" rx="8" ry="15" fill="${c('triceps')}"/>
        <ellipse cx="98" cy="78" rx="8" ry="15" fill="${c('triceps')}"/>
        <ellipse cx="25" cy="108" rx="6.5" ry="15" fill="${c('forearms')}"/>
        <ellipse cx="103" cy="108" rx="6.5" ry="15" fill="${c('forearms')}"/>
        <!-- 臀 -->
        <path d="M48 100 Q64 96 80 100 L80 124 Q64 132 48 124 Z" fill="${c('glutes')}"/>
        <!-- 腘绳 -->
        <path d="M49 128 L62 128 L61 160 L50 160 Z" fill="${c('hams')}"/>
        <path d="M66 128 L79 128 L78 160 L67 160 Z" fill="${c('hams')}"/>
        <path d="M50 164 L60 164 L58 192 L51 192 Z" fill="${c('calves')}"/>
        <path d="M68 164 L78 164 L77 192 L70 192 Z" fill="${c('calves')}"/>
      </g>
    </svg>`;
  }

  /* ---------- 动作示范插画（灰模风格，按器械类型） ---------- */
  function exerciseArt(ex, w = 260, h = 200) {
    const g = 'url(#exGrad)';
    const body = '#b9b9b5', hi = '#ff3b30';
    const grad = `<defs>
      <linearGradient id="exGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#cfcfca"/><stop offset="1" stop-color="#a8a8a3"/>
      </linearGradient>
      <radialGradient id="exGlow"><stop offset="0" stop-color="${hi}" stop-opacity=".55"/><stop offset="1" stop-color="${hi}" stop-opacity="0"/></radialGradient>
    </defs>`;

    const isPush = /卧推|飞鸟|臂屈伸|俯卧撑|夹胸/.test(ex.name);
    const isPull = /引体|下拉|划船|下压|面拉/.test(ex.name);
    const isSquat = /深蹲|腿举|分腿蹲|腿屈伸|提踵|臀推|硬拉|腿弯举|外展/.test(ex.name);
    const isArm = /弯举|下压|腕/.test(ex.name);
    const isCore = /卷腹|举腿|平板|转体|死虫/.test(ex.name);
    const isCardio = ex.equip === '有氧';

    let scene = '';
    if (isPush) {
      scene = `
        <!-- 卧推凳 -->
        <rect x="46" y="118" width="150" height="13" rx="6" fill="${body}"/>
        <rect x="60" y="131" width="10" height="42" rx="4" fill="${body}" opacity=".8"/>
        <rect x="170" y="131" width="10" height="42" rx="4" fill="${body}" opacity=".8"/>
        <!-- 躯干 -->
        <path d="M78 118 Q104 108 132 118 L132 104 Q104 96 78 104 Z" fill="${g}"/>
        <!-- 头 -->
        <circle cx="146" cy="110" r="12" fill="${body}"/>
        <!-- 手臂上举 -->
        <path d="M92 106 L86 74" stroke="${body}" stroke-width="11" stroke-linecap="round"/>
        <path d="M112 104 L118 74" stroke="${body}" stroke-width="11" stroke-linecap="round"/>
        <!-- 杠铃 -->
        <rect x="58" y="66" width="110" height="7" rx="3.5" fill="#8f8f8b"/>
        <circle cx="62" cy="69" r="12" fill="#7d7d79"/>
        <circle cx="164" cy="69" r="12" fill="#7d7d79"/>
        <!-- 胸肌高亮 -->
        <ellipse cx="104" cy="112" rx="26" ry="13" fill="url(#exGlow)"/>
        <ellipse cx="104" cy="112" rx="17" ry="8" fill="${hi}" opacity=".55"/>`;
    } else if (isPull) {
      scene = `
        <rect x="40" y="34" width="176" height="8" rx="4" fill="#8f8f8b"/>
        <path d="M96 42 L96 58" stroke="${body}" stroke-width="10" stroke-linecap="round"/>
        <path d="M160 42 L160 58" stroke="${body}" stroke-width="10" stroke-linecap="round"/>
        <circle cx="128" cy="52" r="12" fill="${body}"/>
        <path d="M128 64 L128 122" stroke="${g}" stroke-width="20" stroke-linecap="round"/>
        <path d="M128 82 L104 100" stroke="${body}" stroke-width="10" stroke-linecap="round"/>
        <path d="M128 82 L152 100" stroke="${body}" stroke-width="10" stroke-linecap="round"/>
        <ellipse cx="128" cy="96" rx="26" ry="22" fill="url(#exGlow)"/>`;
    } else if (isSquat) {
      scene = `
        <rect x="40" y="40" width="96" height="7" rx="3.5" fill="#8f8f8b"/>
        <circle cx="44" cy="43" r="11" fill="#7d7d79"/>
        <circle cx="132" cy="43" r="11" fill="#7d7d79"/>
        <circle cx="88" cy="62" r="12" fill="${body}"/>
        <path d="M88 74 L88 128" stroke="${g}" stroke-width="22" stroke-linecap="round"/>
        <path d="M88 88 L68 74" stroke="${body}" stroke-width="10" stroke-linecap="round"/>
        <path d="M88 88 L108 74" stroke="${body}" stroke-width="10" stroke-linecap="round"/>
        <path d="M88 128 L68 156 L70 186" stroke="${body}" stroke-width="14" stroke-linecap="round" fill="none"/>
        <path d="M88 128 L108 156 L106 186" stroke="${body}" stroke-width="14" stroke-linecap="round" fill="none"/>
        <ellipse cx="88" cy="132" rx="24" ry="26" fill="url(#exGlow)"/>`;
    } else if (isArm) {
      scene = `
        <circle cx="88" cy="44" r="12" fill="${body}"/>
        <path d="M88 56 L88 132" stroke="${g}" stroke-width="22" stroke-linecap="round"/>
        <path d="M88 74 L112 96 L108 74" stroke="${body}" stroke-width="11" stroke-linecap="round" fill="none"/>
        <path d="M88 74 L64 96 L68 74" stroke="${body}" stroke-width="11" stroke-linecap="round" fill="none"/>
        <circle cx="112" cy="96" r="8" fill="#8f8f8b"/>
        <circle cx="64" cy="96" r="8" fill="#8f8f8b"/>
        <ellipse cx="88" cy="86" rx="22" ry="20" fill="url(#exGlow)"/>`;
    } else if (isCore) {
      scene = `
        <rect x="34" y="140" width="176" height="10" rx="5" fill="${body}" opacity=".55"/>
        <path d="M60 138 Q100 118 148 132" stroke="${g}" stroke-width="20" stroke-linecap="round" fill="none"/>
        <circle cx="56" cy="130" r="11" fill="${body}"/>
        <path d="M148 132 L176 122" stroke="${body}" stroke-width="11" stroke-linecap="round"/>
        <ellipse cx="104" cy="130" rx="30" ry="15" fill="url(#exGlow)"/>`;
    } else if (isCardio) {
      scene = `
        <circle cx="96" cy="52" r="12" fill="${body}"/>
        <path d="M96 64 L96 118" stroke="${g}" stroke-width="20" stroke-linecap="round"/>
        <path d="M96 78 L72 96" stroke="${body}" stroke-width="10" stroke-linecap="round"/>
        <path d="M96 78 L122 62" stroke="${body}" stroke-width="10" stroke-linecap="round"/>
        <path d="M96 118 L78 148 L84 178" stroke="${body}" stroke-width="13" stroke-linecap="round" fill="none"/>
        <path d="M96 118 L116 148 L112 178" stroke="${body}" stroke-width="13" stroke-linecap="round" fill="none"/>
        <ellipse cx="96" cy="120" rx="26" ry="24" fill="url(#exGlow)"/>`;
    } else {
      scene = `
        <circle cx="96" cy="50" r="12" fill="${body}"/>
        <path d="M96 62 L96 126" stroke="${g}" stroke-width="22" stroke-linecap="round"/>
        <path d="M96 78 L70 100" stroke="${body}" stroke-width="11" stroke-linecap="round"/>
        <path d="M96 78 L122 100" stroke="${body}" stroke-width="11" stroke-linecap="round"/>
        <path d="M96 126 L80 170" stroke="${body}" stroke-width="14" stroke-linecap="round"/>
        <path d="M96 126 L112 170" stroke="${body}" stroke-width="14" stroke-linecap="round"/>
        <ellipse cx="96" cy="96" rx="26" ry="26" fill="url(#exGlow)"/>`;
    }

    return `<svg class="chart" viewBox="0 0 260 200" width="100%" height="100%">
      ${grad}
      <rect width="260" height="200" fill="none"/>
      ${scene}
    </svg>`;
  }

  global.NorgChart = { ring, progressRing, gauge, line, bars, bodyMap, exerciseArt };
})(window);
