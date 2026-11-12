/* ============================================================
   Norg · 3D 人体引擎 v2
   ------------------------------------------------------------
   目标：还原专业健身 App 的解剖人体视觉
   - 解剖级肌肉分块（胸/腹/背/肩三头/二头三头/股四头/腘绳/臀/小腿两头）
   - 红心蓝边渐变发光（fresnel 着色器注入）
   - 深色影棚背景 + 轮廓光
   - 短裤、哑铃、杠铃、卧推凳、深蹲架
   - 多机位预设（正面/侧面/背面/3/4）
   仍然零模型文件，全部程序化生成。
   ============================================================ */
(function (global) {
  'use strict';

  const D = global.NORG_DATA;
  let THREE = null;

  /* 延迟加载 three.js（本地 vendor，离线可用） */
  function ensureThree() {
    return new Promise((resolve, reject) => {
      if (THREE) return resolve(THREE);
      if (global.THREE) { THREE = global.THREE; return resolve(THREE); }
      const s = document.createElement('script');
      s.src = 'vendor/three.min.js';
      s.onload = () => {
        THREE = global.THREE;
        THREE ? resolve(THREE) : reject(new Error('three.js 未挂载全局'));
      };
      s.onerror = () => reject(new Error('three.js 加载失败'));
      document.head.appendChild(s);
    });
  }

  /* ============================================================
     材质
     ============================================================ */

  /* 皮肤：浅灰偏白，微光泽，接近解剖模型的石膏质感 */
  function skinMaterial() {
    return new THREE.MeshPhysicalMaterial({
      color: 0xe8e8e6,
      roughness: 0.42,
      metalness: 0.0,
      clearcoat: 0.45,
      clearcoatRoughness: 0.35,
      sheen: 0.3,
      sheenColor: new THREE.Color(0xbfd4ff),
    });
  }

  /* 肌肉高亮：红心 + 蓝边，用 fresnel 注入实现渐变发光 */
  function glowMaterial(opts) {
    const { core = 0xff2a18, edge = 0x3d7bff, intensity = 1.0 } = opts || {};
    const m = new THREE.MeshPhysicalMaterial({
      color: 0x1a0503,
      emissive: new THREE.Color(core),
      emissiveIntensity: intensity * 0.55,
      roughness: 0.35,
      metalness: 0.0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
    });

    m.onBeforeCompile = (shader) => {
      shader.uniforms.uCore = { value: new THREE.Color(core) };
      shader.uniforms.uEdge = { value: new THREE.Color(edge) };
      shader.uniforms.uStrength = { value: intensity };

      shader.fragmentShader = `
        uniform vec3 uCore;
        uniform vec3 uEdge;
        uniform float uStrength;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `
        #ifdef FLAT_SHADED
          vec3 gN = normalize(cross(dFdx(vViewPosition), dFdy(vViewPosition)));
        #else
          vec3 gN = normalize(vNormal);
        #endif
        float gFres = pow(1.0 - clamp(abs(dot(gN, normalize(vViewPosition))), 0.0, 1.0), 2.0);
        vec3 gGlow = mix(uCore, uEdge, smoothstep(0.15, 0.85, gFres));
        gl_FragColor.rgb += gGlow * uStrength;
        #include <dithering_fragment>
        `
      );
    };
    // 材质缓存需要区分参数
    m.customProgramCacheKey = () => `glow_${core}_${edge}_${intensity}`;
    return m;
  }

  /* 器械：哑光金属 */
  function equipMaterial(color) {
    return new THREE.MeshStandardMaterial({
      color: color || 0x6e6e6c,
      roughness: 0.42,
      metalness: 0.55,
    });
  }

  /* 杠铃片：深色铸铁 */
  function plateMaterial() {
    return new THREE.MeshStandardMaterial({
      color: 0x3a3a38,
      roughness: 0.55,
      metalness: 0.4,
    });
  }

  /* 短裤：黑色织物 */
  function clothMaterial() {
    return new THREE.MeshPhysicalMaterial({
      color: 0x18181a,
      roughness: 0.82,
      metalness: 0.0,
      sheen: 0.5,
      sheenColor: new THREE.Color(0x333344),
    });
  }

  /* ============================================================
     几何工具
     ============================================================ */
  const G = {
    sphere: (r, seg = 24) => new THREE.SphereGeometry(r, seg, Math.max(12, seg / 2)),
    capsule: (r, len, seg = 20) => new THREE.CapsuleGeometry(r, len, seg / 2, seg),
    box: (w, h, d) => new THREE.BoxGeometry(w, h, d),
    cyl: (rt, rb, h, seg = 20) => new THREE.CylinderGeometry(rt, rb, h, seg),
    /* 用 lathe 生成平滑的锥形肢体 */
    taper: (rTop, rMid, rBot, len, seg = 20) => {
      const pts = [];
      const steps = 10;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        // 二次插值：上→中→下
        const r = t < 0.5
          ? rTop + (rMid - rTop) * (t / 0.5)
          : rMid + (rBot - rMid) * ((t - 0.5) / 0.5);
        pts.push(new THREE.Vector2(Math.max(0.001, r), -t * len));
      }
      return new THREE.LatheGeometry(pts, seg);
    },
  };

  /* ============================================================
     人体：解剖级肌肉分块
     坐标 Y 向上、Z 向前、X 向右。身高约 1.75
     ============================================================ */
  function buildBody(opts) {
    const { skin, glow, glowSoft } = opts || {};
    const root = new THREE.Group();
    const muscles = {};
    const skinMat = skin || skinMaterial();

    const add = (geo, mat, pos, rot, muscle, parent) => {
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      m.castShadow = true;
      m.receiveShadow = true;
      (parent || root).add(m);
      if (muscle) {
        if (!muscles[muscle]) muscles[muscle] = [];
        muscles[muscle].push(m);
      }
      return m;
    };

    /* 肌肉块：用球体压扁拉伸做出肌腹隆起
       —— 关键：z 轴压得很扁（0.3-0.5），并往里收，
          让肌肉块嵌进躯干表面而不是浮在外面 */
    const belly = (muscle, pos, scale, rot, parent) => {
      const m = add(G.sphere(0.05, 20), skinMat, pos, rot, muscle, parent);
      m.scale.set(scale[0], scale[1], scale[2]);
      return m;
    };

    /* ---------- 头 + 颈（无面孔的雕塑感头部） ---------- */
    // 主颅骨
    const head = add(G.sphere(0.106, 32), skinMat, [0, 1.632, 0.004]);
    head.scale.set(0.92, 1.14, 1.0);
    // 后脑（略微后凸）
    const occiput = add(G.sphere(0.086, 24), skinMat, [0, 1.615, -0.038]);
    occiput.scale.set(0.95, 1.0, 0.9);
    // 下颌 / 面部前突
    const jaw = add(G.sphere(0.076, 24), skinMat, [0, 1.558, 0.030]);
    jaw.scale.set(0.88, 0.82, 0.95);
    // 下巴
    const chin = add(G.sphere(0.032, 16), skinMat, [0, 1.532, 0.062]);
    chin.scale.set(0.9, 0.8, 0.85);
    // 眉弓微凸（无眼睛，只给形体暗示）
    const brow = add(G.sphere(0.058, 18), skinMat, [0, 1.622, 0.062]);
    brow.scale.set(1.05, 0.35, 0.5);

    // 颈（斜方肌上端连接）
    add(G.taper(0.056, 0.062, 0.072, 0.105, 18), skinMat, [0, 1.502, 0]);

    /* ---------- 躯干主体（加厚，让肌肉有依附面） ---------- */
    // 胸腔：倒梯形，前后厚度足够
    const chest = add(G.taper(0.172, 0.170, 0.145, 0.31, 26), skinMat, [0, 1.44, 0]);
    chest.scale.set(1.0, 1.0, 0.80);
    chest.rotation.y = Math.PI;

    // 腰腹
    const waist = add(G.taper(0.138, 0.128, 0.122, 0.17, 24), skinMat, [0, 1.14, 0]);
    waist.scale.set(1.0, 1.0, 0.82);
    waist.rotation.y = Math.PI;

    // 髋
    const pelvis = add(G.taper(0.132, 0.138, 0.124, 0.12, 22), skinMat, [0, 1.02, 0]);
    pelvis.scale.set(1.0, 1.0, 0.88);
    pelvis.rotation.y = Math.PI;

    /* ---------- 胸大肌（左右两片，z 压扁贴在胸腔前壁） ---------- */
    [-1, 1].forEach(s => {
      // 主胸肌：横向展开，向前微凸
      const pec = belly('chest', [s * 0.072, 1.348, 0.088], [1.65, 1.20, 0.42], [0.06, 0, s * -0.12]);
      // 上胸：位置更高更靠内
      belly('chest', [s * 0.062, 1.398, 0.078], [1.15, 0.70, 0.34], [0.1, 0, s * -0.16]);
      // 下胸外侧缘（胸肌下沿轮廓）
      belly('chest', [s * 0.088, 1.310, 0.078], [1.05, 0.50, 0.32], [-0.1, 0, s * -0.10]);
    });

    /* ---------- 腹直肌（4 排 × 2 列，紧贴腹壁） ---------- */
    for (let r = 0; r < 4; r++) {
      for (let c = -1; c <= 1; c += 2) {
        const y = 1.250 - r * 0.050;
        const w = 0.80 - r * 0.05;
        belly('abs', [c * 0.026, y, 0.088 - r * 0.003],
          [w, 0.55 - r * 0.02, 0.30], [0, 0, 0]);
      }
    }
    // 腹斜肌：侧壁斜向
    [-1, 1].forEach(s => {
      const ob = add(G.sphere(0.05, 18), skinMat, [s * 0.098, 1.150, 0.040], [0, 0, s * 0.25], 'abs');
      ob.scale.set(0.55, 1.75, 0.50);
    });

    /* ---------- 背阔肌（V 形翼，贴背壁） ---------- */
    [-1, 1].forEach(s => {
      const lat = add(G.sphere(0.05, 20), skinMat, [s * 0.105, 1.240, -0.055], [0.12, 0, s * 0.45], 'back');
      lat.scale.set(0.80, 2.40, 0.40);
      // 上背 / 菱形肌区
      const up = add(G.sphere(0.05, 18), skinMat, [s * 0.075, 1.385, -0.068], [0, 0, s * 0.20], 'back');
      up.scale.set(0.95, 1.05, 0.34);
    });
    // 竖脊肌：两条纵向肌柱
    [-1, 1].forEach(s => {
      const er = add(G.sphere(0.04, 16), skinMat, [s * 0.030, 1.155, -0.082], null, 'back');
      er.scale.set(0.60, 3.00, 0.30);
    });

    /* ---------- 斜方肌 ---------- */
    [-1, 1].forEach(s => {
      const tr = add(G.sphere(0.05, 18), skinMat, [s * 0.068, 1.470, -0.040], [0.20, 0, s * 0.50], 'traps');
      tr.scale.set(1.20, 0.80, 0.42);
    });

    /* ---------- 三角肌（三束） ---------- */
    [-1, 1].forEach(s => {
      // 前束
      belly('shoulders', [s * 0.175, 1.425, 0.048], [1.0, 1.25, 0.9], [0, 0, s * 0.1]);
      // 中束（最外侧，决定肩宽）
      belly('shoulders', [s * 0.205, 1.415, -0.005], [1.1, 1.35, 1.0], [0, 0, s * 0.28]);
      // 后束
      belly('shoulders', [s * 0.168, 1.418, -0.058], [0.95, 1.15, 0.85], [0, 0, s * 0.05]);
    });

    /* ---------- 手臂 ---------- */
    const arms = [];
    [-1, 1].forEach(s => {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.205, 1.418, 0);
      root.add(shoulder);

      // 上臂
      const upper = new THREE.Group();
      shoulder.add(upper);

      // 肱二头肌（前侧隆起）
      belly('biceps', [s * 0.012, -0.115, 0.036], [0.95, 1.9, 0.95], [0, 0, 0], upper);
      // 肱肌
      add(G.sphere(0.042, 16), skinMat, [s * 0.014, -0.155, 0.022], null, null, upper)
        .scale.set(0.95, 1.5, 0.85);
      // 肱三头肌（后侧，长头 + 外侧头）
      belly('triceps', [s * 0.016, -0.115, -0.038], [1.0, 2.0, 0.92], [0, 0, 0], upper);
      belly('triceps', [s * 0.030, -0.075, -0.020], [0.72, 1.1, 0.7], [0, 0, 0], upper);

      // 前臂
      const fore = new THREE.Group();
      fore.position.set(0, -0.245, 0);
      upper.add(fore);

      // 前臂：上粗下细
      add(G.taper(0.048, 0.044, 0.028, 0.215, 18), skinMat, [0, -0.105, 0], null, 'forearms', fore);
      // 腕屈肌隆起
      belly('forearms', [s * 0.010, -0.055, 0.024], [0.75, 1.25, 0.7], [0, 0, 0], fore);

      // 手
      const hand = add(G.sphere(0.042, 16), skinMat, [0, -0.245, 0.004], null, null, fore);
      hand.scale.set(0.85, 1.15, 0.55);
      // 手指
      for (let f = 0; f < 4; f++) {
        add(G.capsule(0.010, 0.042, 8), skinMat,
          [(f - 1.5) * 0.019, -0.292, 0.008], [0.15, 0, 0], null, fore);
      }
      // 拇指
      add(G.capsule(0.011, 0.030, 8), skinMat,
        [s * -0.030, -0.262, 0.020], [0.3, 0, s * 0.9], null, fore);

      arms.push({ side: s, shoulder, upper, fore });
    });

    /* ---------- 腿 ---------- */
    const legs = [];
    [-1, 1].forEach(s => {
      const hipJoint = new THREE.Group();
      hipJoint.position.set(s * 0.082, 1.005, 0);
      root.add(hipJoint);

      const thigh = new THREE.Group();
      hipJoint.add(thigh);

      // 大腿主体
      add(G.taper(0.098, 0.092, 0.062, 0.46, 20), skinMat, [0, 0, 0], null, null, thigh);

      // 股四头肌（外侧头 + 内侧头 + 股直肌）
      belly('quads', [s * 0.030, -0.115, 0.052], [0.95, 2.3, 0.85], [0, 0, 0], thigh);   // 股外侧
      belly('quads', [s * -0.026, -0.290, 0.045], [0.85, 1.5, 0.80], [0, 0, 0], thigh);   // 股内侧（泪滴）
      belly('quads', [s * 0.004, -0.170, 0.068], [0.72, 1.9, 0.62], [0, 0, 0], thigh);    // 股直肌

      // 腘绳肌
      belly('hams', [s * 0.020, -0.150, -0.058], [1.0, 2.2, 0.80], [0, 0, 0], thigh);
      belly('hams', [s * -0.020, -0.150, -0.052], [0.9, 2.0, 0.72], [0, 0, 0], thigh);

      // 小腿
      const shin = new THREE.Group();
      shin.position.set(0, -0.505, 0);
      thigh.add(shin);

      add(G.taper(0.062, 0.056, 0.030, 0.42, 18), skinMat, [0, 0, 0], null, null, shin);
      // 腓肠肌两头
      belly('calves', [s * 0.026, -0.105, -0.038], [0.85, 1.6, 0.85], [0, 0, 0], shin);
      belly('calves', [s * -0.020, -0.120, -0.034], [0.78, 1.4, 0.80], [0, 0, 0], shin);
      // 比目鱼肌
      belly('calves', [s * 0.004, -0.200, -0.026], [0.82, 1.1, 0.72], [0, 0, 0], shin);

      // 脚
      const foot = add(G.box(0.062, 0.032, 0.135), skinMat, [0, -0.435, 0.038], null, null, shin);
      add(G.sphere(0.030, 14), skinMat, [0, -0.432, 0.098], null, null, shin)
        .scale.set(1.05, 0.6, 1.0);
      // 脚跟
      add(G.sphere(0.028, 12), skinMat, [0, -0.432, -0.020], null, null, shin)
        .scale.set(0.95, 0.75, 0.9);

      legs.push({ side: s, hipJoint, thigh, shin });
    });

    /* ---------- 臀部 ---------- */
    [-1, 1].forEach(s => {
      const gl = add(G.sphere(0.05, 20), skinMat, [s * 0.070, 1.005, -0.078], [0, 0, s * 0.12], 'glutes');
      gl.scale.set(1.55, 1.5, 1.15);
    });

    /* ---------- 短裤 ---------- */
    const shortsMat = clothMaterial();
    // 腰臀部分
    const shortsBody = add(G.taper(0.152, 0.158, 0.150, 0.20, 24), shortsMat, [0, 1.05, 0]);
    shortsBody.scale.set(1.02, 1.0, 0.86);
    shortsBody.rotation.y = Math.PI;
    // 裤腿（跟随大腿）
    legs.forEach(l => {
      const cuff = add(G.taper(0.088, 0.086, 0.080, 0.15, 18), shortsMat,
        [0, -0.055, 0], null, null, l.thigh);
      cuff.scale.set(1.06, 1.0, 1.02);
    });

    /* ---------- 收集所有网格 ---------- */
    const allMeshes = [];
    root.traverse(o => { if (o.isMesh) allMeshes.push(o); });

    return {
      root, muscles, allMeshes, arms, legs,
      parts: { chest, waist, pelvis, skinMat, shortsMat },
    };
  }

  /* ============================================================
     器械
     ============================================================ */

  /* 哑铃：手柄 + 多片杠片 */
  function buildDumbbell(scale) {
    const g = new THREE.Group();
    const metal = equipMaterial(0x8a8a88);
    const plate = plateMaterial();
    const s = scale || 1;

    // 手柄
    const handle = new THREE.Mesh(G.cyl(0.016 * s, 0.016 * s, 0.16 * s, 12), metal);
    handle.rotation.z = Math.PI / 2;
    handle.castShadow = true;
    g.add(handle);

    // 两侧杠片
    [-1, 1].forEach(side => {
      // 内片（大）
      const p1 = new THREE.Mesh(G.cyl(0.072 * s, 0.072 * s, 0.030 * s, 20), plate);
      p1.rotation.z = Math.PI / 2;
      p1.position.x = side * 0.062 * s;
      p1.castShadow = true;
      g.add(p1);

      // 外片（小）
      const p2 = new THREE.Mesh(G.cyl(0.056 * s, 0.056 * s, 0.024 * s, 18), plate);
      p2.rotation.z = Math.PI / 2;
      p2.position.x = side * 0.098 * s;
      p2.castShadow = true;
      g.add(p2);

      // 卡箍
      const c = new THREE.Mesh(G.cyl(0.020 * s, 0.020 * s, 0.014 * s, 10), metal);
      c.rotation.z = Math.PI / 2;
      c.position.x = side * 0.118 * s;
      g.add(c);
    });

    return g;
  }

  /* 杠铃：长杆 + 两侧杠片 */
  function buildBarbell(width, plateR) {
    const g = new THREE.Group();
    const metal = equipMaterial(0x9a9a98);
    const plate = plateMaterial();
    const w = width || 1.30;
    const pr = plateR || 0.16;

    const bar = new THREE.Mesh(G.cyl(0.016, 0.016, w, 14), metal);
    bar.rotation.z = Math.PI / 2;
    bar.castShadow = true;
    g.add(bar);

    [-1, 1].forEach(side => {
      // 三层杠片
      [[pr, 0.036], [pr * 0.86, 0.030], [pr * 0.66, 0.024]].forEach(([r, h], i) => {
        const p = new THREE.Mesh(G.cyl(r, r, h, 22), plate);
        p.rotation.z = Math.PI / 2;
        p.position.x = side * (w / 2 - 0.075 - i * 0.038);
        p.castShadow = true;
        g.add(p);
      });
      // 卡箍
      const c = new THREE.Mesh(G.cyl(0.024, 0.024, 0.018, 10), metal);
      c.rotation.z = Math.PI / 2;
      c.position.x = side * (w / 2 - 0.028);
      g.add(c);
    });

    return g;
  }

  /* 卧推凳 */
  function buildBench() {
    const g = new THREE.Group();
    const pad = new THREE.MeshPhysicalMaterial({
      color: 0x1c1c1e, roughness: 0.75, metalness: 0.05,
    });
    const metal = equipMaterial(0x5a5a58);

    // 凳面
    const seat = new THREE.Mesh(G.box(0.30, 0.055, 1.02), pad);
    seat.position.set(0, 0.455, 0.02);
    seat.castShadow = true; seat.receiveShadow = true;
    g.add(seat);

    // 支腿（A 形架）
    [[-0.125, 0.40], [0.125, 0.40], [-0.125, -0.34], [0.125, -0.34]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(G.cyl(0.020, 0.024, 0.44, 10), metal);
      leg.position.set(x, 0.22, z);
      leg.castShadow = true;
      g.add(leg);
    });
    // 横撑
    [0.40, -0.34].forEach(z => {
      const br = new THREE.Mesh(G.cyl(0.016, 0.016, 0.26, 10), metal);
      br.rotation.z = Math.PI / 2;
      br.position.set(0, 0.02, z);
      g.add(br);
    });

    // 杠铃架
    [-0.40, 0.40].forEach(x => {
      const post = new THREE.Mesh(G.cyl(0.020, 0.020, 0.72, 10), metal);
      post.position.set(x, 0.50, 0.34);
      post.castShadow = true;
      g.add(post);
      // 挂钩
      const hook = new THREE.Mesh(G.box(0.075, 0.026, 0.05), metal);
      hook.position.set(x, 0.855, 0.34);
      g.add(hook);
    });

    return g;
  }

  /* 深蹲架：只在两侧，不挡正面视线 */
  function buildSquatRack() {
    const g = new THREE.Group();
    const metal = equipMaterial(0x5a5a58);

    // 只做两根立柱 + 顶部横梁，且向外移，不遮挡人体
    [-0.62, 0.62].forEach(x => {
      const post = new THREE.Mesh(G.cyl(0.024, 0.026, 1.20, 10), metal);
      post.position.set(x, 0.60, -0.10);
      post.castShadow = true;
      g.add(post);

      // 底部支脚（沿 z 方向）
      const foot = new THREE.Mesh(G.cyl(0.020, 0.020, 0.44, 8), metal);
      foot.rotation.x = Math.PI / 2;
      foot.position.set(x, 0.02, -0.10);
      g.add(foot);

      // 挂钩
      const hook = new THREE.Mesh(G.box(0.05, 0.022, 0.06), metal);
      hook.position.set(x * 0.92, 1.06, 0.02);
      g.add(hook);
    });

    // 顶部横梁（很高，不挡视线）
    const top = new THREE.Mesh(G.cyl(0.014, 0.014, 1.24, 8), metal);
    top.rotation.z = Math.PI / 2;
    top.position.set(0, 1.20, -0.10);
    g.add(top);

    return g;
  }

  /* 影棚地面 */
  function buildFloor() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a2c30, roughness: 0.92, metalness: 0.02,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0;
    plane.receiveShadow = true;
    g.add(plane);
    return g;
  }

  /* ============================================================
     动作动画
     关节：arms[].shoulder/upper/fore，legs[].hipJoint/thigh/shin
     ============================================================ */
  const ANIMS = {
    /* 哑铃弯举（对应参考图） */
    curl: {
      props: 'dumbbell',
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.x = 0.02;
          a.shoulder.rotation.z = a.side * 0.10;
          a.upper.rotation.x = 0.04;
          a.fore.rotation.x = -0.45;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 2.2) + 1) / 2;   // 0..1
        b.arms.forEach(a => {
          a.fore.rotation.x = -0.45 - p * 1.55;
          a.shoulder.rotation.x = 0.02 - p * 0.06;
        });
        b._dumbbells.forEach((d, i) => {
          const a = b.arms[i];
          // 哑铃跟随前臂
          d.position.copy(a.fore.localToWorld(new THREE.Vector3(0, -0.30, 0.01)));
        });
      },
    },

    /* 卧推
       数学依据（root.rotation.x = +π/2 时）：
         局部(x, y, z) → 世界(x, posY - z, posZ + y)
       肩局部 y=1.418，要让肩落在凳面中部 z≈0.45 → posZ = -0.97
       躯干局部 z 范围 ±0.09，映射到世界 y = posY - z → 贴住凳面 y≈0.48 */
    bench: {
      props: 'bench',
      pose: b => {
        b.root.rotation.x = Math.PI / 2;
        b.root.position.set(0, 0.50, -0.97);

        // 手臂：肩关节绕 x 转到几乎垂直向上（世界 +y）
        // 局部 +x 旋转 → 上臂朝世界 +y 方向
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * 0.42;
          a.shoulder.rotation.x = 1.52;
          a.upper.rotation.x = 0.0;
          a.fore.rotation.x = 0.0;
        });

        // 腿：屈膝，脚踩地
        b.legs.forEach(l => {
          l.hipJoint.rotation.x = -0.55;
          l.thigh.rotation.x = 0.95;
          l.shin.rotation.x = -1.75;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.9) + 1) / 2;
        b.arms.forEach(a => {
          // 下放时前臂弯到 -1.05，推起时伸直
          a.fore.rotation.x = -1.05 + p * 1.05;
        });
        if (b._bar) {
          // 杠铃压在双手正上方：肩 z=0.45，手再往前 0.18 → z≈0.27
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
          a.shoulder.rotation.x = -1.32;
          a.shoulder.rotation.z = a.side * 0.52;
          a.upper.rotation.x = 0.18;
          a.fore.rotation.x = -0.70;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.5) + 1) / 2;
        const d = p * 0.88;
        b.legs.forEach(l => {
          l.hipJoint.rotation.x = d * 1.05;
          l.thigh.rotation.x = -d * 2.05;
          l.shin.rotation.x = d * 1.95;
        });
        b.root.position.y = -d * 0.32;
        b.parts.chest.rotation.x = d * 0.30;
        b.parts.waist.rotation.x = d * 0.30;
        b.parts.pelvis.rotation.x = d * 0.18;
        // 杠铃压在斜方肌上
        if (b._bar) {
          b._bar.position.set(0, 1.455 - d * 0.32, -0.055);
          b._bar.visible = true;
        }
      },
    },

    /* 硬拉 / 划船（髋主导） */
    hinge: {
      props: 'barbell',
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.x = 0.28;
          a.upper.rotation.x = 0.16;
          a.fore.rotation.x = -0.28;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.4) + 1) / 2;
        const bend = p * 1.0;
        b.legs.forEach(l => {
          l.hipJoint.rotation.x = bend * 0.60;
          l.thigh.rotation.x = -bend * 0.72;
          l.shin.rotation.x = bend * 0.52;
        });
        b.parts.chest.rotation.x = bend * 0.70;
        b.parts.waist.rotation.x = bend * 0.40;
        b.parts.pelvis.rotation.x = bend * 0.25;
        b.arms.forEach(a => { a.shoulder.rotation.x = 0.28 + bend * 0.42; });
        // 杠铃贴着小腿/膝前，随下蹲下降
        if (b._bar) {
          b._bar.position.set(0, 0.42 - bend * 0.12, 0.195);
          b._bar.visible = true;
        }
      },
    },

    /* 推举 */
    press: {
      props: 'dumbbell',
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * 0.30;
          a.shoulder.rotation.x = -0.22;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.7) + 1) / 2;
        b.arms.forEach(a => {
          a.shoulder.rotation.x = -0.22 - p * 2.20;
          a.fore.rotation.x = -p * 0.30;
        });
        b._dumbbells.forEach((d, i) => {
          d.position.copy(b.arms[i].fore.localToWorld(new THREE.Vector3(0, -0.30, 0.01)));
        });
      },
    },

    /* 引体 / 下拉 */
    pulldown: {
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * 0.46;
          a.shoulder.rotation.x = -2.55;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.6) + 1) / 2;
        b.arms.forEach(a => {
          a.shoulder.rotation.x = -2.55 + p * 1.05;
          a.fore.rotation.x = -0.28 + p * 0.48;
        });
      },
    },

    /* 侧平举 */
    lateral: {
      props: 'dumbbell',
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * 0.10;
          a.fore.rotation.x = -0.15;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.8) + 1) / 2;
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * (0.10 + p * 1.05);
          a.fore.rotation.x = -0.15;
        });
        b._dumbbells.forEach((d, i) => {
          d.position.copy(b.arms[i].fore.localToWorld(new THREE.Vector3(0, -0.30, 0.01)));
        });
      },
    },

    /* 卷腹 */
    crunch: {
      pose: b => {
        b.root.rotation.x = -Math.PI / 2;
        b.root.position.set(0, 0.46, 0);
        b.legs.forEach(l => {
          l.hipJoint.rotation.x = 0.58;
          l.thigh.rotation.x = -1.58;
          l.shin.rotation.x = 1.38;
        });
        b.arms.forEach(a => {
          a.shoulder.rotation.x = -0.58;
          a.upper.rotation.x = -0.48;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.9) + 1) / 2;
        b.parts.chest.rotation.x = -p * 0.46;
        b.parts.waist.rotation.x = -p * 0.26;
      },
    },

    /* 站立呼吸（默认） */
    idle: {
      pose: () => {},
      tick: (b, t) => {
        const p = Math.sin(t * 0.85);
        b.root.position.y = p * 0.006;
        b.parts.chest.rotation.z = p * 0.010;
        b.parts.waist.rotation.z = p * 0.008;
        // 手臂轻微摆动
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * (0.12 + Math.sin(t * 0.85 + 0.4) * 0.012);
        });
      },
    },
  };

  /* 动作名 → 动画 */
  function pickAnim(name) {
    const n = name || '';
    if (/侧平举/.test(n)) return 'lateral';
    if (/弯举|腕弯举/.test(n)) return 'curl';
    if (/卧推|飞鸟|臂屈伸|俯卧撑|夹胸/.test(n)) return 'bench';
    if (/深蹲|腿举|分腿蹲|腿屈伸|提踵|臀推|外展/.test(n)) return 'squat';
    if (/硬拉|划船|罗马尼亚/.test(n)) return 'hinge';
    if (/推举|前平举|面拉/.test(n)) return 'press';
    if (/引体|下拉|下压/.test(n)) return 'pulldown';
    if (/卷腹|举腿|平板|转体|死虫/.test(n)) return 'crunch';
    return 'idle';
  }

  /* ============================================================
     机位预设
     ============================================================ */
  const VIEWS = {
    front: { pos: [0, 1.02, 3.05], target: [0, 0.92, 0] },
    back:  { pos: [0, 1.02, -3.05], target: [0, 0.92, 0] },
    side:  { pos: [3.05, 1.02, 0], target: [0, 0.92, 0] },
    q34:   { pos: [2.05, 1.20, 2.30], target: [0, 0.92, 0] },
    /* 卧推专用：从侧上方看，能看清躺姿 */
    bench: { pos: [2.35, 1.55, 1.35], target: [0, 0.62, 0.10] },
    /* 深蹲专用：略低视角，突出腿部 */
    squat: { pos: [1.85, 1.05, 2.45], target: [0, 0.80, 0] },
    /* 硬拉专用：侧面偏前，看髋铰链 */
    hinge: { pos: [2.55, 1.15, 1.85], target: [0, 0.62, 0.05] },
  };

  /* 动画 → 推荐机位 */
  const ANIM_VIEW = {
    bench: 'bench',
    squat: 'squat',
    hinge: 'hinge',
    crunch: 'bench',
    curl: 'q34',
    press: 'q34',
    lateral: 'front',
    pulldown: 'q34',
    idle: 'q34',
  };

  /* ============================================================
     查看器
     ============================================================ */
  function createViewer(container, opts) {
    const {
      height = 300,
      autoRotate = false,
      dark = true,
      showProps = true,
    } = opts || {};

    const scene = new THREE.Scene();

    /* 深色影棚背景（径向渐变由 CSS 提供，这里透明） */
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    camera.position.set(...VIEWS.q34.pos);
    camera.lookAt(...VIEWS.q34.target);

    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    const dom = renderer.domElement;
    dom.style.width = '100%';
    dom.style.height = '100%';
    dom.style.display = 'block';
    dom.style.touchAction = 'pan-y';
    dom.style.cursor = 'grab';

    /* ---------- 灯光：影棚三点 + 冷色轮廓 ---------- */
    const key = new THREE.DirectionalLight(0xffffff, 3.0);
    key.position.set(2.2, 3.4, 2.6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 12;
    key.shadow.camera.left = -1.6;
    key.shadow.camera.right = 1.6;
    key.shadow.camera.top = 2.4;
    key.shadow.camera.bottom = -0.4;
    key.shadow.bias = -0.0015;
    key.shadow.radius = 3;
    scene.add(key);

    // 补光：左前方柔和
    const fill = new THREE.DirectionalLight(0xdce6ff, 1.1);
    fill.position.set(-2.6, 1.8, 2.0);
    scene.add(fill);

    // 轮廓光：背后冷蓝，勾出边缘（参考图那种蓝边）
    const rim = new THREE.DirectionalLight(0x5a9bff, 2.6);
    rim.position.set(-1.4, 2.0, -3.0);
    scene.add(rim);

    // 轮廓光 2：右侧暖白
    const rim2 = new THREE.DirectionalLight(0xfff0e0, 1.2);
    rim2.position.set(2.4, 1.6, -2.2);
    scene.add(rim2);

    // 环境：冷灰
    scene.add(new THREE.HemisphereLight(0x8fa8cc, 0x2a2c30, 1.0));

    /* ---------- 地面 ---------- */
    scene.add(buildFloor());

    /* ---------- 人体 ---------- */
    const skin = skinMaterial();
    const body = buildBody({ skin });
    scene.add(body.root);

    /* ---------- 器械（按需显示） ---------- */
    const props = {
      bench: buildBench(),
      rack: buildSquatRack(),
    };
    Object.values(props).forEach(p => { p.visible = false; scene.add(p); });

    const barbell = buildBarbell(1.30, 0.155);
    barbell.visible = false;
    scene.add(barbell);
    body._bar = barbell;

    /* 一对哑铃，挂场景里由动画驱动位置 */
    const dumbbells = [buildDumbbell(1.0), buildDumbbell(1.0)];
    dumbbells.forEach(d => { d.visible = false; scene.add(d); });
    body._dumbbells = dumbbells;

    const setProps = key => {
      Object.entries(props).forEach(([k, p]) => { p.visible = showProps && k === key; });
    };
    setProps(null);

    /* ---------- 高亮材质缓存 ---------- */
    const matHot = glowMaterial({ core: 0xff2a18, edge: 0x4a86ff, intensity: 1.35 });
    const matWarm = glowMaterial({ core: 0xd4261a, edge: 0x2f66d8, intensity: 0.75 });
    const matCool = glowMaterial({ core: 0xff5a2a, edge: 0x5aa0ff, intensity: 0.45 });

    /* 记录每个 mesh 的原始材质 */
    body.allMeshes.forEach(m => { m.userData._origMat = m.material; });

    /* 高亮指定肌群 */
    function highlight(muscleKeys, o) {
      const { mode = 'hot' } = o || {};
      const active = new Set(muscleKeys || []);
      // 先全部恢复
      body.allMeshes.forEach(m => { m.material = m.userData._origMat; });
      // 激活的换发光材质
      Object.entries(body.muscles).forEach(([k, list]) => {
        if (!active.has(k)) return;
        const mat = mode === 'warm' ? matWarm : mode === 'cool' ? matCool : matHot;
        list.forEach(m => { m.material = mat; });
      });
    }

    /* 热力图：按训练量给不同强度 */
    function heatmap(volume) {
      const maxV = Math.max(1, ...Object.values(volume || {}));
      body.allMeshes.forEach(m => { m.material = m.userData._origMat; });
      Object.entries(body.muscles).forEach(([k, list]) => {
        const v = volume[k] || 0;
        if (v <= 0) return;
        const t = v / maxV;
        const mat = glowMaterial({
          core: 0xff2a18,
          edge: 0x4a86ff,
          intensity: 0.35 + t * 1.15,
        });
        list.forEach(m => { m.material = mat; });
      });
    }

    /* ---------- 尺寸自适应 ---------- */
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

    /* ---------- 渲染循环 ---------- */
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
      if (autoRotate && !dragging) rotY += 0.0035;
      body.root.rotation.y = rotY;

      // 哑铃朝向跟随前臂
      dumbbells.forEach((d, i) => {
        if (!d.visible) return;
        const a = body.arms[i];
        const q = new THREE.Quaternion();
        a.fore.getWorldQuaternion(q);
        d.quaternion.copy(q);
      });

      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(loop);

    /* ---------- 拖拽旋转 ---------- */
    const onDown = e => {
      dragging = true;
      dom.style.cursor = 'grabbing';
      lastX = (e.touches ? e.touches[0].clientX : e.clientX);
    };
    const onMove = e => {
      if (!dragging) return;
      const x = (e.touches ? e.touches[0].clientX : e.clientX);
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

    /* ---------- 重置姿态 ---------- */
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

        // 器械
        setProps(ANIMS[key].props || null);

        // 杠铃：推 / 蹲 / 拉
        barbell.visible = showProps && ['bench', 'squat', 'hinge'].includes(key);
        // 哑铃：弯举 / 推举 / 侧平举
        const useDb = showProps && ['curl', 'press', 'lateral'].includes(key);
        dumbbells.forEach(d => { d.visible = useDb; });

        if (ANIMS[key].pose) ANIMS[key].pose(body);

        // 自动切到该动作的最佳机位
        const vk = ANIM_VIEW[key] || 'q34';
        const v = VIEWS[vk];
        camera.position.set(...v.pos);
        camera.lookAt(...v.target);
        rotY = 0;
        body.root.rotation.y = 0;

        // 初始位置
        if (useDb) {
          dumbbells.forEach((d, i) => {
            d.position.copy(body.arms[i].fore.localToWorld(new THREE.Vector3(0, -0.30, 0.01)));
          });
        }
        t0 = performance.now();
      },

      setPlaying(v) { playing = v; },
      highlight,
      heatmap,

      /* 机位预设 */
      setView(name) {
        const v = VIEWS[name] || VIEWS.q34;
        camera.position.set(...v.pos);
        camera.lookAt(...v.target);
        if (name === 'back') rotY = Math.PI;
        else rotY = 0;
        body.root.rotation.y = rotY;
      },

      resetView() { rotY = 0; this.setView('q34'); },

      dispose() {
        cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        global.removeEventListener('mousemove', onMove);
        global.removeEventListener('mouseup', onUp);
        renderer.dispose();
        scene.traverse(o => {
          if (o.isMesh) {
            o.geometry && o.geometry.dispose();
          }
        });
        container.innerHTML = '';
      },
    };
  }

  global.Norg3D = {
    ensureThree, createViewer, buildBody, pickAnim, ANIMS, VIEWS,
    get THREE() { return THREE; },
  };
})(window);
