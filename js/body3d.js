/* ============================================================
   Norg · 3D 人体引擎 v3
   ------------------------------------------------------------
   严格对照原 App（Norg）的动作示范页：
   - 背景：浅灰白径向渐变（#f0f0ee → #d8d8d4）
   - 人体：灰绿色 (#a8b0a8 系)，有肌肉分割线
   - 高亮：红色 + 光晕（bloom 后处理，不是硬色块）
   - 器械：与人体同色系，略深
   - 底部投影：柔和椭圆阴影

   几何策略：用「基础体 + 肌肉块」两层
   - 基础体：连续的躯干/四肢（不再是一颗颗球）
   - 肌肉块：贴在表面的薄壳，有明确边界，形成肌肉分割感
   ============================================================ */
(function (global) {
  'use strict';

  let THREE = null;

  function ensureThree() {
    return new Promise((resolve, reject) => {
      if (THREE) return resolve(THREE);
      if (global.THREE) { THREE = global.THREE; return resolve(THREE); }
      const s = document.createElement('script');
      s.src = 'vendor/three.min.js';
      s.onload = () => {
        THREE = global.THREE;
        THREE ? resolve(THREE) : reject(new Error('three.js 未挂载'));
      };
      s.onerror = () => reject(new Error('three.js 加载失败'));
      document.head.appendChild(s);
    });
  }

  /* ============================================================
     调色板（对照原图取色）
     ============================================================ */
  const PAL = {
    skin:      0xa9b3ab,   // 灰绿肤色
    skinDark:  0x8e988f,   // 阴影侧
    muscle:    0xb4bdb5,   // 肌肉略亮
    equip:     0x9aa39b,   // 器械与人体同色系
    equipDark: 0x7d8680,
    plate:     0x8a938c,
    cloth:     0x2a2e2c,   // 短裤深灰
    bgTop:     0xf2f2f0,
    bgBot:     0xd6d6d2,
    hot:       0xff2a18,   // 高亮红
  };

  /* 皮肤材质：哑光，轻微粗糙（不透明，去掉任何透明感） */
  function matSkin(color) {
    return new THREE.MeshStandardMaterial({
      color: color === undefined ? PAL.skin : color,
      roughness: 0.60,
      metalness: 0.02,
      transparent: false,
      opacity: 1,
      flatShading: false,
    });
  }

  /* 肌肉材质：比皮肤亮一点，用于肌肉块 */
  function matMuscle() {
    return new THREE.MeshStandardMaterial({
      color: PAL.muscle,
      roughness: 0.54,
      metalness: 0.02,
      transparent: false,
      opacity: 1,
    });
  }

  /* 高亮材质：红色 + 自发光（配合 bloom 出光晕） */
  function matHot(intensity) {
    return new THREE.MeshStandardMaterial({
      color: 0xff3b28,
      emissive: new THREE.Color(0xff2010),
      emissiveIntensity: intensity === undefined ? 1.6 : intensity,
      roughness: 0.4,
      metalness: 0.0,
    });
  }

  function matEquip(dark) {
    return new THREE.MeshStandardMaterial({
      color: dark ? PAL.equipDark : PAL.equip,
      roughness: 0.5,
      metalness: 0.15,
    });
  }

  function matCloth() {
    return new THREE.MeshStandardMaterial({
      color: PAL.cloth,
      roughness: 0.85,
      metalness: 0.0,
    });
  }

  /* ============================================================
     几何
     ============================================================ */
  const G = {
    sph: (r, s = 24) => new THREE.SphereGeometry(r, s, Math.max(12, s / 2)),
    cap: (r, l, s = 20) => new THREE.CapsuleGeometry(r, l, Math.max(6, s / 3), s),
    box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    cyl: (rt, rb, h, s = 20) => new THREE.CylinderGeometry(rt, rb, h, s),

    /* 平滑锥形（用于肢体、躯干）—— 上中下三段半径 */
    taper: (rTop, rMid, rBot, len, seg = 24) => {
      const pts = [];
      const N = 14;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        let r;
        if (t < 0.5) {
          const u = t / 0.5;
          r = rTop + (rMid - rTop) * (u * u * (3 - 2 * u)); // smoothstep
        } else {
          const u = (t - 0.5) / 0.5;
          r = rMid + (rBot - rMid) * (u * u * (3 - 2 * u));
        }
        pts.push(new THREE.Vector2(Math.max(0.002, r), -t * len));
      }
      return new THREE.LatheGeometry(pts, seg);
    },
  };

  /* ============================================================
     人体
     ============================================================ */
  function buildBody(opts) {
    const o = opts || {};
    const root = new THREE.Group();
    const muscles = {};
    const skin = matSkin();
    const muscle = matMuscle();

    const add = (geo, mat, pos, rot, muscleKey, parent) => {
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      m.castShadow = true;
      m.receiveShadow = true;
      (parent || root).add(m);
      if (muscleKey) {
        if (!muscles[muscleKey]) muscles[muscleKey] = [];
        muscles[muscleKey].push(m);
      }
      return m;
    };

    /* 肌肉块：用极扁的椭球做"表面隆起"
       —— 关键是 z 轴压到 0.10-0.22，且位置略往内嵌，
          这样它只在中段凸出 1-2mm，视觉上是肌腹而不是石头 */
    const slab = (key, pos, scale, rot, parent) => {
      const m = add(G.sph(0.05, 24), muscle, pos, rot, key, parent);
      m.scale.set(scale[0], scale[1], Math.min(0.22, scale[2]));
      return m;
    };

    /* ---------- 头 ---------- */
    // 椭球头（无面孔，跟原图一致）
    const head = add(G.sph(0.105, 32), skin, [0, 1.632, 0.004]);
    head.scale.set(0.90, 1.15, 0.98);
    // 下颌收窄
    add(G.sph(0.074, 22), skin, [0, 1.556, 0.026]).scale.set(0.86, 0.80, 0.94);
    // 后脑
    add(G.sph(0.082, 22), skin, [0, 1.616, -0.040]).scale.set(0.94, 0.98, 0.90);

    /* ---------- 颈 ---------- */
    add(G.taper(0.052, 0.058, 0.072, 0.10, 20), skin, [0, 1.505, 0]);

    /* ---------- 躯干（连续基础体，加粗） ---------- */
    // 胸腔：上宽下窄，前后厚实
    const chest = add(G.taper(0.190, 0.192, 0.160, 0.30, 28), skin, [0, 1.445, 0]);
    chest.scale.set(1.0, 1.0, 0.80);
    chest.rotation.y = Math.PI;

    // 腰
    const waist = add(G.taper(0.152, 0.144, 0.138, 0.16, 24), skin, [0, 1.155, 0]);
    waist.scale.set(1.0, 1.0, 0.82);
    waist.rotation.y = Math.PI;

    // 髋
    const pelvis = add(G.taper(0.144, 0.150, 0.136, 0.12, 22), skin, [0, 1.030, 0]);
    pelvis.scale.set(1.0, 1.0, 0.88);
    pelvis.rotation.y = Math.PI;

    /* ---------- 胸肌（两片薄壳，中间留缝） ---------- */
    [-1, 1].forEach(s => {
      // 主胸肌
      slab('chest', [s * 0.070, 1.352, 0.082], [1.55, 1.05, 0.30], [0.04, 0, s * -0.10]);
      // 上胸（锁骨部）
      slab('chest', [s * 0.058, 1.400, 0.072], [1.05, 0.62, 0.24], [0.10, 0, s * -0.14]);
      // 下胸外缘
      slab('chest', [s * 0.086, 1.312, 0.072], [0.98, 0.45, 0.22], [-0.10, 0, s * -0.08]);
    });

    /* ---------- 腹直肌（4×2 薄片 + 分割感） ---------- */
    for (let r = 0; r < 4; r++) {
      for (let c = -1; c <= 1; c += 2) {
        const y = 1.252 - r * 0.048;
        const w = 0.72 - r * 0.04;
        slab('abs', [c * 0.024, y, 0.082 - r * 0.003], [w, 0.50 - r * 0.02, 0.20], [0, 0, 0]);
      }
    }
    // 腹斜肌
    [-1, 1].forEach(s => {
      const ob = add(G.sph(0.05, 18), muscle, [s * 0.094, 1.150, 0.032], [0, 0, s * 0.26], 'abs');
      ob.scale.set(0.50, 1.65, 0.34);
    });

    /* ---------- 背 ---------- */
    [-1, 1].forEach(s => {
      // 背阔肌
      const lat = add(G.sph(0.05, 20), muscle, [s * 0.100, 1.242, -0.048], [0.10, 0, s * 0.46], 'back');
      lat.scale.set(0.76, 2.30, 0.30);
      // 上背
      const up = add(G.sph(0.05, 18), muscle, [s * 0.072, 1.385, -0.058], [0, 0, s * 0.18], 'back');
      up.scale.set(0.92, 1.00, 0.26);
    });
    // 竖脊肌
    [-1, 1].forEach(s => {
      const er = add(G.sph(0.04, 16), muscle, [s * 0.028, 1.155, -0.070], null, 'back');
      er.scale.set(0.56, 2.85, 0.24);
    });

    /* ---------- 斜方肌 ---------- */
    [-1, 1].forEach(s => {
      const tr = add(G.sph(0.05, 18), muscle, [s * 0.064, 1.468, -0.034], [0.16, 0, s * 0.48], 'traps');
      tr.scale.set(1.16, 0.76, 0.34);
    });

    /* ---------- 三角肌（三束） ---------- */
    [-1, 1].forEach(s => {
      slab('shoulders', [s * 0.170, 1.428, 0.040], [0.95, 1.15, 0.72], [0, 0, s * 0.10]);
      slab('shoulders', [s * 0.196, 1.418, -0.004], [1.05, 1.25, 0.82], [0, 0, s * 0.26]);
      slab('shoulders', [s * 0.162, 1.420, -0.050], [0.90, 1.05, 0.68], [0, 0, s * 0.04]);
    });

    /* ---------- 手臂 ---------- */
    const arms = [];
    [-1, 1].forEach(s => {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.196, 1.418, 0);
      root.add(shoulder);

      const upper = new THREE.Group();
      shoulder.add(upper);

      // 上臂基础体（连续，加粗）
      add(G.taper(0.060, 0.064, 0.050, 0.235, 18), skin, [0, 0, 0], null, null, upper);

      // 肱二头
      slab('biceps', [s * 0.010, -0.105, 0.034], [0.92, 1.70, 0.24], [0, 0, 0], upper);
      // 肱肌
      slab('biceps', [s * 0.012, -0.152, 0.020], [0.80, 0.82, 0.20], [0, 0, 0], upper);
      // 肱三头
      slab('triceps', [s * 0.012, -0.108, -0.036], [0.96, 1.80, 0.24], [0, 0, 0], upper);
      slab('triceps', [s * 0.026, -0.070, -0.020], [0.66, 0.98, 0.18], [0, 0, 0], upper);

      // 前臂
      const fore = new THREE.Group();
      fore.position.set(0, -0.238, 0);
      upper.add(fore);

      add(G.taper(0.052, 0.048, 0.030, 0.210, 18), skin, [0, 0, 0], null, null, fore);
      // 前臂屈肌
      slab('forearms', [s * 0.008, -0.050, 0.022], [0.72, 1.12, 0.20], [0, 0, 0], fore);

      // 手
      const hand = add(G.sph(0.040, 16), skin, [0, -0.240, 0.004], null, null, fore);
      hand.scale.set(0.82, 1.10, 0.52);
      // 手指
      for (let f = 0; f < 4; f++) {
        add(G.cap(0.0095, 0.040, 8), skin, [(f - 1.5) * 0.018, -0.284, 0.008], [0.12, 0, 0], null, fore);
      }
      add(G.cap(0.010, 0.028, 8), skin, [s * -0.028, -0.256, 0.018], [0.28, 0, s * 0.85], null, fore);

      arms.push({ side: s, shoulder, upper, fore });
    });

    /* ---------- 腿 ---------- */
    const legs = [];
    [-1, 1].forEach(s => {
      const hipJoint = new THREE.Group();
      hipJoint.position.set(s * 0.078, 1.010, 0);
      root.add(hipJoint);

      const thigh = new THREE.Group();
      hipJoint.add(thigh);

      // 大腿基础体（加粗）
      add(G.taper(0.108, 0.104, 0.068, 0.450, 20), skin, [0, 0, 0], null, null, thigh);

      // 股四头三束
      slab('quads', [s * 0.030, -0.110, 0.056], [0.94, 2.10, 0.26], [0, 0, 0], thigh);   // 外侧
      slab('quads', [s * -0.028, -0.285, 0.048], [0.82, 1.40, 0.24], [0, 0, 0], thigh);   // 内侧泪滴
      slab('quads', [s * 0.002, -0.165, 0.070], [0.70, 1.75, 0.22], [0, 0, 0], thigh);    // 股直肌

      // 腘绳
      slab('hams', [s * 0.020, -0.148, -0.060], [0.96, 2.05, 0.24], [0, 0, 0], thigh);
      slab('hams', [s * -0.020, -0.148, -0.054], [0.86, 1.85, 0.22], [0, 0, 0], thigh);

      // 小腿
      const shin = new THREE.Group();
      shin.position.set(0, -0.495, 0);
      thigh.add(shin);

      add(G.taper(0.068, 0.060, 0.032, 0.410, 18), skin, [0, 0, 0], null, null, shin);
      // 腓肠肌两头
      slab('calves', [s * 0.024, -0.100, -0.040], [0.80, 1.48, 0.26], [0, 0, 0], shin);
      slab('calves', [s * -0.020, -0.112, -0.036], [0.74, 1.30, 0.24], [0, 0, 0], shin);
      // 比目鱼肌
      slab('calves', [s * 0.002, -0.190, -0.026], [0.76, 1.02, 0.22], [0, 0, 0], shin);

      // 脚
      add(G.box(0.058, 0.030, 0.130), skin, [0, -0.424, 0.036], null, null, shin);
      add(G.sph(0.028, 14), skin, [0, -0.422, 0.094], null, null, shin).scale.set(1.0, 0.58, 0.95);
      add(G.sph(0.026, 12), skin, [0, -0.422, -0.018], null, null, shin).scale.set(0.92, 0.72, 0.88);

      legs.push({ side: s, hipJoint, thigh, shin });
    });

    /* ---------- 臀 ---------- */
    [-1, 1].forEach(s => {
      const gl = add(G.sph(0.05, 20), muscle, [s * 0.066, 1.008, -0.066], [0, 0, s * 0.10], 'glutes');
      gl.scale.set(1.45, 1.40, 0.90);
    });

    /* ---------- 短裤（覆盖髋部 + 大腿上段） ---------- */
    const cloth = matCloth();
    // 腰臀部：比髋略大的锥形，包住臀和腹下
    const shorts = add(G.taper(0.146, 0.156, 0.150, 0.235, 26), cloth, [0, 1.070, 0]);
    shorts.scale.set(1.03, 1.0, 0.90);
    shorts.rotation.y = Math.PI;
    // 裤腿：沿大腿包住上 1/3，跟随大腿骨骼
    legs.forEach(l => {
      const cuff = add(G.taper(0.094, 0.096, 0.086, 0.175, 20), cloth,
        [0, -0.030, 0], null, null, l.thigh);
      cuff.scale.set(1.05, 1.0, 1.06);
    });

    const allMeshes = [];
    root.traverse(o => { if (o.isMesh) allMeshes.push(o); });

    return {
      root, muscles, allMeshes, arms, legs,
      parts: { chest, waist, pelvis, skin, muscle, cloth },
    };
  }

  /* ============================================================
     器械（与人体同色系）
     ============================================================ */
  function buildBench() {
    const g = new THREE.Group();
    const m = matEquip();
    const md = matEquip(true);

    // 凳面（深灰软垫）
    const pad = new THREE.Mesh(G.box(0.30, 0.05, 0.98), matCloth());
    pad.position.set(0, 0.452, 0.02);
    pad.castShadow = true; pad.receiveShadow = true;
    g.add(pad);

    // A 形支腿
    [[-0.122, 0.38], [0.122, 0.38], [-0.122, -0.34], [0.122, -0.34]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(G.cyl(0.019, 0.023, 0.44, 10), m);
      leg.position.set(x, 0.22, z);
      leg.castShadow = true;
      g.add(leg);
    });
    [0.38, -0.34].forEach(z => {
      const br = new THREE.Mesh(G.cyl(0.015, 0.015, 0.25, 10), m);
      br.rotation.z = Math.PI / 2;
      br.position.set(0, 0.015, z);
      g.add(br);
    });

    // 杠铃立柱 + 挂钩
    [-0.40, 0.40].forEach(x => {
      const post = new THREE.Mesh(G.cyl(0.019, 0.019, 0.70, 10), m);
      post.position.set(x, 0.49, 0.33);
      post.castShadow = true;
      g.add(post);
      const hook = new THREE.Mesh(G.box(0.070, 0.024, 0.048), md);
      hook.position.set(x, 0.845, 0.33);
      g.add(hook);
      // 底座
      const base = new THREE.Mesh(G.cyl(0.055, 0.060, 0.02, 12), md);
      base.position.set(x, 0.01, 0.33);
      g.add(base);
    });

    return g;
  }

  function buildBarbell(width, plateR) {
    const g = new THREE.Group();
    const m = matEquip();
    const pm = new THREE.MeshStandardMaterial({
      color: PAL.plate, roughness: 0.62, metalness: 0.1,
    });
    const w = width || 1.34;
    const pr = plateR || 0.155;

    const bar = new THREE.Mesh(G.cyl(0.0145, 0.0145, w, 14), m);
    bar.rotation.z = Math.PI / 2;
    bar.castShadow = true;
    g.add(bar);

    [-1, 1].forEach(side => {
      [[pr, 0.034], [pr * 0.84, 0.028], [pr * 0.62, 0.022]].forEach(([r, h], i) => {
        const p = new THREE.Mesh(G.cyl(r, r, h, 24), pm);
        p.rotation.z = Math.PI / 2;
        p.position.x = side * (w / 2 - 0.072 - i * 0.036);
        p.castShadow = true;
        g.add(p);
      });
      const c = new THREE.Mesh(G.cyl(0.022, 0.022, 0.016, 10), m);
      c.rotation.z = Math.PI / 2;
      c.position.x = side * (w / 2 - 0.026);
      g.add(c);
    });

    return g;
  }

  function buildDumbbell(scale) {
    const g = new THREE.Group();
    const m = matEquip();
    const pm = new THREE.MeshStandardMaterial({
      color: PAL.plate, roughness: 0.62, metalness: 0.1,
    });
    const s = scale || 1;

    const handle = new THREE.Mesh(G.cyl(0.015 * s, 0.015 * s, 0.155 * s, 12), m);
    handle.rotation.z = Math.PI / 2;
    handle.castShadow = true;
    g.add(handle);

    [-1, 1].forEach(side => {
      const p1 = new THREE.Mesh(G.cyl(0.070 * s, 0.070 * s, 0.028 * s, 22), pm);
      p1.rotation.z = Math.PI / 2;
      p1.position.x = side * 0.060 * s;
      p1.castShadow = true;
      g.add(p1);

      const p2 = new THREE.Mesh(G.cyl(0.054 * s, 0.054 * s, 0.022 * s, 20), pm);
      p2.rotation.z = Math.PI / 2;
      p2.position.x = side * 0.094 * s;
      p2.castShadow = true;
      g.add(p2);

      const c = new THREE.Mesh(G.cyl(0.019 * s, 0.019 * s, 0.013 * s, 10), m);
      c.rotation.z = Math.PI / 2;
      c.position.x = side * 0.113 * s;
      g.add(c);
    });

    return g;
  }

  function buildSquatRack() {
    const g = new THREE.Group();
    const m = matEquip();
    const md = matEquip(true);

    [-0.60, 0.60].forEach(x => {
      const post = new THREE.Mesh(G.cyl(0.021, 0.023, 1.16, 10), m);
      post.position.set(x, 0.58, -0.08);
      post.castShadow = true;
      g.add(post);

      const foot = new THREE.Mesh(G.cyl(0.018, 0.018, 0.42, 8), md);
      foot.rotation.x = Math.PI / 2;
      foot.position.set(x, 0.012, -0.08);
      g.add(foot);

      const hook = new THREE.Mesh(G.box(0.046, 0.020, 0.055), md);
      hook.position.set(x * 0.90, 1.03, 0.03);
      g.add(hook);
    });

    const top = new THREE.Mesh(G.cyl(0.013, 0.013, 1.22, 8), m);
    top.rotation.z = Math.PI / 2;
    top.position.set(0, 1.16, -0.08);
    g.add(top);

    return g;
  }

  /* 柔和椭圆地面阴影（原图那种） */
  function buildShadow() {
    const g = new THREE.Group();
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    const grd = ctx.createRadialGradient(128, 128, 10, 128, 128, 124);
    grd.addColorStop(0, 'rgba(90,100,95,0.42)');
    grd.addColorStop(0.55, 'rgba(90,100,95,0.16)');
    grd.addColorStop(1, 'rgba(90,100,95,0)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);

    const tex = new THREE.CanvasTexture(c);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.002;
    g.add(mesh);
    return g;
  }

  /* ============================================================
     动作动画
     ============================================================ */
  const ANIMS = {
    /* 哑铃弯举 —— 对照参考图 */
    curl: {
      props: 'dumbbell',
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.x = 0.04;
          a.shoulder.rotation.z = a.side * 0.13;
          a.upper.rotation.x = 0.06;
          a.fore.rotation.x = -0.30;
        });
        b.legs.forEach(l => {
          l.hipJoint.rotation.z = l.side * 0.02;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 2.1) + 1) / 2;
        b.arms.forEach(a => {
          a.fore.rotation.x = -0.30 - p * 1.60;
          a.shoulder.rotation.x = 0.04 - p * 0.05;
        });
      },
    },

    /* 卧推
       root.rotation.x = +π/2 时：局部(x,y,z) → 世界(x, posY−z, posZ+y)
       肩局部 y=1.418 → 世界 z = posZ + 1.418，要肩落在凳面中部 z≈0.45
       → posZ = -0.97 */
    bench: {
      props: 'bench',
      pose: b => {
        b.root.rotation.x = Math.PI / 2;
        b.root.position.set(0, 0.50, -0.97);
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * 0.42;
          a.shoulder.rotation.x = 1.52;
        });
        b.legs.forEach(l => {
          l.hipJoint.rotation.x = -0.55;
          l.thigh.rotation.x = 0.95;
          l.shin.rotation.x = -1.75;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.9) + 1) / 2;
        b.arms.forEach(a => {
          a.fore.rotation.x = -1.05 + p * 1.05;
        });
        if (b._bar) {
          b._bar.position.set(0, 0.80 + p * 0.26, 0.27);
          b._bar.visible = true;
        }
      },
    },

    /* 深蹲 */
    squat: {
      props: 'rack',
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.x = -1.30;
          a.shoulder.rotation.z = a.side * 0.50;
          a.upper.rotation.x = 0.16;
          a.fore.rotation.x = -0.68;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.5) + 1) / 2;
        const d = p * 0.86;
        b.legs.forEach(l => {
          l.hipJoint.rotation.x = d * 1.02;
          l.thigh.rotation.x = -d * 2.00;
          l.shin.rotation.x = d * 1.90;
        });
        b.root.position.y = -d * 0.30;
        b.parts.chest.rotation.x = d * 0.28;
        b.parts.waist.rotation.x = d * 0.28;
        b.parts.pelvis.rotation.x = d * 0.16;
        // 杠铃压在斜方肌上（略高于肩，稍靠后）
        if (b._bar) {
          b._bar.position.set(0, 1.485 - d * 0.30, -0.075);
          b._bar.visible = true;
        }
      },
    },

    /* 硬拉 / 划船 */
    hinge: {
      props: 'barbell',
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.x = 0.26;
          a.upper.rotation.x = 0.14;
          a.fore.rotation.x = -0.26;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.4) + 1) / 2;
        const bend = p * 1.0;
        b.legs.forEach(l => {
          l.hipJoint.rotation.x = bend * 0.58;
          l.thigh.rotation.x = -bend * 0.70;
          l.shin.rotation.x = bend * 0.50;
        });
        b.parts.chest.rotation.x = bend * 0.68;
        b.parts.waist.rotation.x = bend * 0.38;
        b.parts.pelvis.rotation.x = bend * 0.24;
        b.arms.forEach(a => { a.shoulder.rotation.x = 0.26 + bend * 0.40; });
        if (b._bar) {
          b._bar.position.set(0, 0.42 - bend * 0.12, 0.19);
          b._bar.visible = true;
        }
      },
    },

    /* 推举 */
    press: {
      props: 'dumbbell',
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * 0.28;
          a.shoulder.rotation.x = -0.20;
          a.fore.rotation.x = -0.10;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.7) + 1) / 2;
        b.arms.forEach(a => {
          a.shoulder.rotation.x = -0.20 - p * 2.15;
          a.fore.rotation.x = -0.10 - p * 0.25;
        });
      },
    },

    /* 下拉 / 引体 */
    pulldown: {
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * 0.44;
          a.shoulder.rotation.x = -2.50;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.6) + 1) / 2;
        b.arms.forEach(a => {
          a.shoulder.rotation.x = -2.50 + p * 1.00;
          a.fore.rotation.x = -0.26 + p * 0.44;
        });
      },
    },

    /* 侧平举 */
    lateral: {
      props: 'dumbbell',
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * 0.10;
          a.fore.rotation.x = -0.12;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.8) + 1) / 2;
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * (0.10 + p * 1.00);
        });
      },
    },

    /* 卷腹 */
    crunch: {
      pose: b => {
        b.root.rotation.x = -Math.PI / 2;
        b.root.position.set(0, 0.44, 0);
        b.legs.forEach(l => {
          l.hipJoint.rotation.x = 0.55;
          l.thigh.rotation.x = -1.55;
          l.shin.rotation.x = 1.35;
        });
        b.arms.forEach(a => {
          a.shoulder.rotation.x = -0.55;
          a.upper.rotation.x = -0.45;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.9) + 1) / 2;
        b.parts.chest.rotation.x = -p * 0.44;
        b.parts.waist.rotation.x = -p * 0.24;
      },
    },

    /* 站立 */
    idle: {
      pose: () => {},
      tick: (b, t) => {
        const p = Math.sin(t * 0.85);
        b.root.position.y = p * 0.005;
        b.parts.chest.rotation.z = p * 0.008;
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * (0.13 + Math.sin(t * 0.85 + 0.4) * 0.010);
        });
      },
    },
  };

  function pickAnim(name) {
    const n = name || '';
    if (/侧平举/.test(n)) return 'lateral';
    if (/弯举/.test(n)) return 'curl';
    if (/卧推|飞鸟|臂屈伸|俯卧撑|夹胸/.test(n)) return 'bench';
    if (/深蹲|腿举|分腿蹲|腿屈伸|提踵|臀推|外展/.test(n)) return 'squat';
    if (/硬拉|划船|罗马尼亚/.test(n)) return 'hinge';
    if (/推举|前平举|面拉/.test(n)) return 'press';
    if (/引体|下拉|下压/.test(n)) return 'pulldown';
    if (/卷腹|举腿|平板|转体|死虫/.test(n)) return 'crunch';
    return 'idle';
  }

  /* ============================================================
     机位（拉远，保证全身入镜）
     ============================================================ */
  const VIEWS = {
    front: { pos: [0, 0.95, 3.55], target: [0, 0.86, 0] },
    back:  { pos: [0, 0.95, -3.55], target: [0, 0.86, 0] },
    side:  { pos: [3.55, 0.95, 0], target: [0, 0.86, 0] },
    q34:   { pos: [2.35, 1.05, 2.70], target: [0, 0.86, 0] },
    bench: { pos: [2.55, 1.65, 1.55], target: [0, 0.58, 0.05] },
    squat: { pos: [2.20, 0.95, 2.85], target: [0, 0.74, 0] },
    hinge: { pos: [2.85, 1.05, 2.20], target: [0, 0.58, 0.05] },
  };

  const ANIM_VIEW = {
    bench: 'bench', squat: 'squat', hinge: 'hinge', crunch: 'bench',
    curl: 'q34', press: 'q34', lateral: 'front', pulldown: 'q34', idle: 'q34',
  };

  /* ============================================================
     查看器
     ============================================================ */
  function createViewer(container, opts) {
    const o = opts || {};
    const height = o.height || 300;
    const autoRotate = !!o.autoRotate;
    const showProps = o.showProps !== false;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 60);
    camera.position.set(...VIEWS.q34.pos);
    camera.lookAt(...VIEWS.q34.target);

    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    const dom = renderer.domElement;
    dom.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';

    /* ---------- 灯光（原图是柔和的影棚光） ---------- */
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(2.0, 3.2, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -1.5;
    key.shadow.camera.right = 1.5;
    key.shadow.camera.top = 2.4;
    key.shadow.camera.bottom = -0.4;
    key.shadow.bias = -0.0012;
    key.shadow.radius = 4;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xeef4ff, 1.0);
    fill.position.set(-2.4, 1.6, 1.8);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.9);
    rim.position.set(-0.8, 1.8, -2.4);
    scene.add(rim);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa39b, 1.15));

    /* ---------- 地面阴影 ---------- */
    scene.add(buildShadow());

    /* ---------- 人体 ---------- */
    const body = buildBody();
    scene.add(body.root);

    /* ---------- 器械 ---------- */
    const props = { bench: buildBench(), rack: buildSquatRack() };
    Object.values(props).forEach(p => { p.visible = false; scene.add(p); });

    const barbell = buildBarbell(1.34, 0.155);
    barbell.visible = false;
    scene.add(barbell);
    body._bar = barbell;

    const dumbbells = [buildDumbbell(1.0), buildDumbbell(1.0)];
    dumbbells.forEach(d => { d.visible = false; scene.add(d); });

    const setProps = k => {
      Object.entries(props).forEach(([kk, p]) => { p.visible = showProps && kk === k; });
    };
    setProps(null);

    /* ---------- 高亮 ---------- */
    body.allMeshes.forEach(m => { m.userData._origMat = m.material; });

    const matHotMain = matHot(1.7);
    const matHotSoft = matHot(0.85);

    function highlight(keys, oo) {
      const mode = (oo && oo.mode) || 'hot';
      const active = new Set(keys || []);
      body.allMeshes.forEach(m => { m.material = m.userData._origMat; });
      Object.entries(body.muscles).forEach(([k, list]) => {
        if (!active.has(k)) return;
        const mat = mode === 'soft' ? matHotSoft : matHotMain;
        list.forEach(m => { m.material = mat; });
      });
    }

    function heatmap(volume) {
      const v = volume || {};
      const maxV = Math.max(1, ...Object.values(v));
      body.allMeshes.forEach(m => { m.material = m.userData._origMat; });
      Object.entries(body.muscles).forEach(([k, list]) => {
        const val = v[k] || 0;
        if (val <= 0) return;
        const t = val / maxV;
        const mat = matHot(0.5 + t * 1.3);
        list.forEach(m => { m.material = mat; });
      });
    }

    /* ---------- 尺寸 ---------- */
    function resize() {
      const w = container.clientWidth || 300;
      const h = container.clientHeight || height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    let ro = null;
    if (global.ResizeObserver) {
      ro = new ResizeObserver(resize);
      ro.observe(container);
    }

    /* ---------- 循环 ---------- */
    let animKey = 'idle';
    let playing = true;
    let t0 = performance.now();
    let raf = null;
    let rotY = 0;
    let dragging = false, lastX = 0;

    function loop(now) {
      raf = requestAnimationFrame(loop);
      const t = (now - t0) / 1000;

      if (playing && ANIMS[animKey] && ANIMS[animKey].tick) {
        ANIMS[animKey].tick(body, t);
      }
      if (autoRotate && !dragging) rotY += 0.003;
      body.root.rotation.y = rotY;

      // 哑铃朝向跟随前臂
      dumbbells.forEach((d, i) => {
        if (!d.visible) return;
        const a = body.arms[i];
        const q = new THREE.Quaternion();
        a.fore.getWorldQuaternion(q);
        d.quaternion.copy(q);
        if (!d.position.lengthSq() || ANIMS[animKey].props === 'dumbbell') {
          d.position.copy(a.fore.localToWorld(new THREE.Vector3(0, -0.30, 0.01)));
        }
      });

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(loop);

    /* ---------- 拖拽 ---------- */
    const onDown = e => {
      dragging = true;
      dom.style.cursor = 'grabbing';
      lastX = e.touches ? e.touches[0].clientX : e.clientX;
    };
    const onMove = e => {
      if (!dragging) return;
      const x = e.touches ? e.touches[0].clientX : e.clientX;
      rotY += (x - lastX) * 0.011;
      lastX = x;
      if (e.touches) e.preventDefault();
    };
    const onUp = () => { dragging = false; dom.style.cursor = 'grab'; };

    dom.addEventListener('mousedown', onDown);
    global.addEventListener('mousemove', onMove);
    global.addEventListener('mouseup', onUp);
    dom.addEventListener('touchstart', onDown, { passive: true });
    dom.addEventListener('touchmove', onMove, { passive: false });
    dom.addEventListener('touchend', onUp);

    function resetPose() {
      body.root.rotation.set(0, rotY, 0);
      body.root.position.set(0, 0, 0);
      body.parts.chest.rotation.set(0, 0, 0);
      body.parts.waist.rotation.set(0, 0, 0);
      body.parts.pelvis.rotation.set(0, 0, 0);
      body.arms.forEach(a => {
        a.shoulder.rotation.set(0, 0, 0);
        a.upper.rotation.set(0, 0, 0);
        a.fore.rotation.set(0, 0, 0);
      });
      body.legs.forEach(l => {
        l.hipJoint.rotation.set(0, 0, 0);
        l.thigh.rotation.set(0, 0, 0);
        l.shin.rotation.set(0, 0, 0);
      });
    }

    return {
      scene, camera, renderer, body,

      setAnim(key) {
        if (!ANIMS[key]) return;
        animKey = key;
        resetPose();
        setProps(ANIMS[key].props || null);

        barbell.visible = showProps && ['bench', 'squat', 'hinge'].includes(key);
        const useDb = showProps && ['curl', 'press', 'lateral'].includes(key);
        dumbbells.forEach(d => { d.visible = useDb; });

        if (ANIMS[key].pose) ANIMS[key].pose(body);

        const vk = ANIM_VIEW[key] || 'q34';
        const v = VIEWS[vk];
        camera.position.set(...v.pos);
        camera.lookAt(...v.target);
        rotY = 0;
        body.root.rotation.y = 0;

        if (useDb) {
          dumbbells.forEach((d, i) => {
            d.position.copy(body.arms[i].fore.localToWorld(new THREE.Vector3(0, -0.30, 0.01)));
          });
        }
        t0 = performance.now();
      },

      setPlaying(v) { playing = v; },
      highlight, heatmap,

      setView(name) {
        const v = VIEWS[name] || VIEWS.q34;
        camera.position.set(...v.pos);
        camera.lookAt(...v.target);
        rotY = name === 'back' ? Math.PI : 0;
        body.root.rotation.y = rotY;
      },

      resetView() { this.setView('q34'); },

      dispose() {
        cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        global.removeEventListener('mousemove', onMove);
        global.removeEventListener('mouseup', onUp);
        renderer.dispose();
        scene.traverse(x => { if (x.isMesh && x.geometry) x.geometry.dispose(); });
        container.innerHTML = '';
      },
    };
  }

  global.Norg3D = {
    ensureThree, createViewer, buildBody, pickAnim, ANIMS, VIEWS, PAL,
    get THREE() { return THREE; },
  };
})(window);
