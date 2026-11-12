/* ============================================================
   Norg · 3D 人体引擎
   ------------------------------------------------------------
   不加载任何模型文件，纯程序化生成：
   - 用胶囊体 / 球体拼出肌肉群
   - 每个肌群是独立 Mesh，可单独高亮染色
   - 骨骼用关节层级组织，支持动作动画（卧推 / 深蹲 / 划船 / 弯举…）
   - 灰模材质 + 红色发光肌群，还原原 App 的视觉效果
   ============================================================ */
(function (global) {
  'use strict';

  const D = global.NORG_DATA;
  let THREE = null;

  /* 延迟加载 three.js（本地 vendor，离线也能用） */
  function ensureThree() {
    return new Promise((resolve, reject) => {
      if (THREE) return resolve(THREE);
      if (global.THREE) { THREE = global.THREE; return resolve(THREE); }
      const s = document.createElement('script');
      s.src = 'vendor/three.min.js';
      s.onload = () => {
        THREE = global.THREE;
        THREE ? resolve(THREE) : reject(new Error('three.js 加载后未挂载全局'));
      };
      s.onerror = () => reject(new Error('three.js 加载失败'));
      document.head.appendChild(s);
    });
  }

  /* ---------------- 材质 ---------------- */
  const MAT = {
    // 灰模：类似原 App 的浅灰塑料感
    body: () => new THREE.MeshStandardMaterial({
      color: 0xc4c4c0, roughness: 0.68, metalness: 0.04,
    }),
    // 深色底座/器械
    equip: () => new THREE.MeshStandardMaterial({
      color: 0x8e8e8a, roughness: 0.5, metalness: 0.3,
    }),
    // 高亮肌群：鲜红发光，明显区别于灰模
    hot: () => new THREE.MeshStandardMaterial({
      color: 0xff2d20, emissive: 0xff1508, emissiveIntensity: 2.2,
      roughness: 0.35, metalness: 0.0,
    }),
    // 次要肌群：暗红
    warm: () => new THREE.MeshStandardMaterial({
      color: 0xb8342c, emissive: 0x7a0e08, emissiveIntensity: 0.85,
      roughness: 0.55, metalness: 0.0,
    }),
  };

  /* ---------------- 几何辅助 ---------------- */
  function capsule(r, len, seg = 16) {
    const g = new THREE.CapsuleGeometry(r, len, seg / 2, seg);
    return g;
  }
  function sphere(r, seg = 20) {
    return new THREE.SphereGeometry(r, seg, seg);
  }
  function box(w, h, d) {
    return new THREE.BoxGeometry(w, h, d);
  }
  function cylinder(rt, rb, h, seg = 16) {
    return new THREE.CylinderGeometry(rt, rb, h, seg);
  }

  /* ============================================================
     器械：程序化生成的简易器材，让动作有支撑感
     ============================================================ */
  function buildBench() {
    const g = new THREE.Group();
    const mat = MAT.equip();
    const dark = new THREE.MeshStandardMaterial({ color: 0x6e6e6a, roughness: 0.5, metalness: 0.4 });

    // 凳面
    const pad = new THREE.Mesh(box(0.34, 0.055, 0.92), mat);
    pad.position.set(0, 0.40, 0.02);
    pad.castShadow = true; pad.receiveShadow = true;
    g.add(pad);

    // 四根支腿
    [[-0.13, 0.30], [0.13, 0.30], [-0.13, -0.28], [0.13, -0.28]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(cylinder(0.022, 0.026, 0.40, 10), dark);
      leg.position.set(x, 0.20, z);
      leg.castShadow = true;
      g.add(leg);
    });

    // 横撑
    const brace = new THREE.Mesh(box(0.30, 0.03, 0.03), dark);
    brace.position.set(0, 0.10, 0.30);
    g.add(brace);
    const brace2 = brace.clone();
    brace2.position.z = -0.28;
    g.add(brace2);

    // 杠铃架
    [-0.34, 0.34].forEach(x => {
      const post = new THREE.Mesh(cylinder(0.022, 0.022, 0.62, 10), dark);
      post.position.set(x, 0.42, 0.30);
      post.castShadow = true;
      g.add(post);
      const hook = new THREE.Mesh(box(0.07, 0.028, 0.03), dark);
      hook.position.set(x, 0.70, 0.30);
      g.add(hook);
    });

    return g;
  }

  /* 杠铃：横杆 + 两侧杠片 */
  function buildBarbell(width = 0.9, plateR = 0.11) {
    const g = new THREE.Group();
    const barMat = new THREE.MeshStandardMaterial({ color: 0x9a9a96, roughness: 0.35, metalness: 0.7 });
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x5a5a56, roughness: 0.6, metalness: 0.3 });

    const bar = new THREE.Mesh(cylinder(0.014, 0.014, width, 12), barMat);
    bar.rotation.z = Math.PI / 2;
    bar.castShadow = true;
    g.add(bar);

    [-1, 1].forEach(s => {
      [0, 0.045, 0.09].forEach((off, i) => {
        const r = plateR * (1 - i * 0.12);
        const p = new THREE.Mesh(cylinder(r, r, 0.022, 18), plateMat);
        p.rotation.z = Math.PI / 2;
        p.position.x = s * (width / 2 - 0.055 - off);
        p.castShadow = true;
        g.add(p);
      });
    });
    return g;
  }

  /* 深蹲架 */
  function buildSquatRack() {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x6e6e6a, roughness: 0.5, metalness: 0.4 });
    [-0.42, 0.42].forEach(x => {
      [-0.22, 0.22].forEach(z => {
        const post = new THREE.Mesh(cylinder(0.024, 0.024, 1.0, 10), dark);
        post.position.set(x, 0.5, z);
        post.castShadow = true;
        g.add(post);
      });
      const cross = new THREE.Mesh(box(0.03, 0.03, 0.46), dark);
      cross.position.set(x, 0.98, 0);
      g.add(cross);
    });
    return g;
  }

  /* 地板 */
  function buildFloor() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdedede, roughness: 0.95, metalness: 0,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.002;
    plane.receiveShadow = true;
    g.add(plane);
    return g;
  }

  /* ============================================================
     人体模型：按肌群组织，每个肌群一个可高亮 Mesh
     坐标：Y 向上，Z 向前，X 向右。身高约 1.75 单位
     ============================================================ */
  function buildBody(opts) {
    const { scale = 1 } = opts || {};
    const root = new THREE.Group();
    const muscles = {};   // { chest: [mesh...], ... }

    const add = (geo, mat, pos, rot, muscle, parent) => {
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
      m.castShadow = true;
      (parent || root).add(m);
      if (muscle) {
        if (!muscles[muscle]) muscles[muscle] = [];
        muscles[muscle].push(m);
      }
      return m;
    };

    const bodyMat = MAT.body();

    /* ---------- 头 + 颈 ---------- */
    add(sphere(0.105, 24), bodyMat, [0, 0.905, 0]);
    add(cylinder(0.048, 0.055, 0.07, 16), bodyMat, [0, 0.80, 0]);

    /* ---------- 躯干骨架 ---------- */
    // 胸腔：倒梯形感，肩宽腰窄
    const torso = add(capsule(0.138, 0.27, 20), bodyMat, [0, 0.605, 0]);
    torso.scale.set(1.18, 1, 0.76);

    // 腹部（比胸窄，形成 V 形）
    const waist = add(capsule(0.098, 0.11, 18), bodyMat, [0, 0.435, 0]);
    waist.scale.set(1.06, 1, 0.80);

    // 髋
    const hip = add(capsule(0.112, 0.055, 18), bodyMat, [0, 0.355, 0]);
    hip.scale.set(1.16, 1, 0.86);

    /* ---------- 胸肌（左右两片） ---------- */
    [-1, 1].forEach(s => {
      const m = add(sphere(0.075, 18), bodyMat, [s * 0.062, 0.655, 0.075], null, 'chest');
      m.scale.set(1.15, 0.78, 0.52);
    });

    /* ---------- 腹肌（分块） ---------- */
    for (let r = 0; r < 3; r++) {
      for (let c = -1; c <= 1; c += 2) {
        const m = add(box(0.038, 0.036, 0.03), bodyMat,
          [c * 0.026, 0.545 - r * 0.05, 0.082], null, 'abs');
      }
    }
    // 腹斜肌
    [-1, 1].forEach(s => {
      add(box(0.022, 0.10, 0.05), bodyMat, [s * 0.088, 0.50, 0.045], [0, 0, s * 0.15], 'abs');
    });

    /* ---------- 背肌 ---------- */
    [-1, 1].forEach(s => {
      // 背阔肌
      const m = add(sphere(0.09, 16), bodyMat, [s * 0.075, 0.60, -0.06], null, 'back');
      m.scale.set(0.85, 1.5, 0.45);
      // 斜方肌
      const t = add(sphere(0.055, 14), bodyMat, [s * 0.045, 0.745, -0.035], null, 'traps');
      t.scale.set(1.1, 0.9, 0.5);
    });
    // 竖脊肌
    add(box(0.05, 0.22, 0.04), bodyMat, [0, 0.50, -0.088], null, 'back');

    /* ---------- 肩（三角肌） ---------- */
    [-1, 1].forEach(s => {
      const m = add(sphere(0.072, 18), bodyMat, [s * 0.185, 0.685, 0], null, 'shoulders');
      m.scale.set(1, 1.15, 1);
    });

    /* ---------- 手臂 ---------- */
    const arms = [];
    [-1, 1].forEach(s => {
      const shoulder = new THREE.Group();
      shoulder.position.set(s * 0.20, 0.665, 0);
      root.add(shoulder);

      // 上臂（肱二头 + 肱三头）
      const upper = new THREE.Group();
      shoulder.add(upper);

      const bicep = add(capsule(0.045, 0.135, 14), bodyMat, [0, -0.10, 0.012], null, 'biceps', upper);
      bicep.scale.set(1, 1, 0.9);
      const tricep = add(capsule(0.043, 0.14, 14), bodyMat, [0, -0.10, -0.018], null, 'triceps', upper);
      tricep.scale.set(1, 1, 0.85);

      // 前臂
      const fore = new THREE.Group();
      fore.position.set(0, -0.205, 0);
      upper.add(fore);
      const forearm = add(capsule(0.038, 0.145, 14), bodyMat, [0, -0.095, 0], null, 'forearms', fore);
      forearm.scale.set(1, 1, 0.88);
      // 手
      add(sphere(0.042, 12), bodyMat, [0, -0.185, 0], null, null, fore).scale.set(1, 1.2, 0.6);

      arms.push({ side: s, shoulder, upper, fore });
    });

    /* ---------- 腿 ---------- */
    const legs = [];
    [-1, 1].forEach(s => {
      const hipJoint = new THREE.Group();
      hipJoint.position.set(s * 0.072, 0.345, 0);
      root.add(hipJoint);

      // 大腿：股四头 + 腘绳 + 臀
      const thigh = new THREE.Group();
      hipJoint.add(thigh);

      const quad = add(capsule(0.068, 0.21, 16), bodyMat, [0, -0.145, 0.012], null, 'quads', thigh);
      quad.scale.set(1, 1, 0.94);
      const ham = add(capsule(0.056, 0.185, 14), bodyMat, [0, -0.145, -0.038], null, 'hams', thigh);
      ham.scale.set(0.95, 1, 0.82);

      // 小腿
      const shin = new THREE.Group();
      shin.position.set(0, -0.305, 0);
      thigh.add(shin);
      const calf = add(capsule(0.048, 0.175, 14), bodyMat, [0, -0.105, -0.008], null, 'calves', shin);
      calf.scale.set(1, 1, 0.94);
      // 脚
      add(box(0.058, 0.03, 0.135), bodyMat, [0, -0.222, 0.032], null, null, shin);

      legs.push({ side: s, hipJoint, thigh, shin });
    });

    /* ---------- 臀 ---------- */
    [-1, 1].forEach(s => {
      const m = add(sphere(0.078, 16), bodyMat, [s * 0.062, 0.345, -0.062], null, 'glutes');
      m.scale.set(1.05, 0.95, 0.85);
    });

    /* ---------- 收集所有网格用于统一材质切换 ---------- */
    const allMeshes = [];
    root.traverse(o => { if (o.isMesh) allMeshes.push(o); });

    return {
      root, muscles, allMeshes, arms, legs,
      parts: { torso, waist, hip, bodyMat },
    };
  }

  /* ============================================================
     高亮：给指定肌群染色，其余保持灰模
     ============================================================ */
  function highlight(body, activeMuscles, opts) {
    const { fadeOthers = true } = opts || {};
    const activeSet = new Set(activeMuscles || []);

    // 先全部恢复灰模
    body.allMeshes.forEach(m => {
      if (!m.userData._origMat) m.userData._origMat = m.material;
      m.material = m.userData._origMat;
    });

    Object.entries(body.muscles).forEach(([key, list]) => {
      const isActive = activeSet.has(key);
      const mat = isActive ? MAT.hot() : (fadeOthers ? MAT.body() : null);
      if (!mat) return;
      list.forEach(m => { m.material = mat; });
    });
  }

  /* 根据训练量给肌群上不同深浅（热力图） */
  function heatmap(body, volumeData) {
    const maxV = Math.max(1, ...Object.values(volumeData));
    Object.entries(body.muscles).forEach(([key, list]) => {
      const v = volumeData[key] || 0;
      if (v <= 0) {
        list.forEach(m => { m.material = body.parts.bodyMat; });
        return;
      }
      const t = v / maxV;
      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHSL(0.0, 0.85, 0.35 + t * 0.28),
        emissive: new THREE.Color(0xff2010),
        emissiveIntensity: 0.25 + t * 1.1,
        roughness: 0.5, metalness: 0.02,
      });
      list.forEach(m => { m.material = mat; });
    });
  }

  /* ============================================================
     动作动画：按动作类型驱动关节
     ============================================================ */
  const ANIMS = {
    /* 卧推：躺在凳上，手臂屈伸 */
    bench: {
      props: 'bench',
      pose: b => {
        // 躺下：整体绕 X 旋转 -90°，抬高到凳面高度
        b.root.rotation.x = -Math.PI / 2;
        b.root.position.set(0, 0.50, 0.02);
        // 手臂张开抓住杠铃
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * 0.42;
          a.shoulder.rotation.x = -0.55;
          a.upper.rotation.x = -0.25;
          a.fore.rotation.x = -0.85;
        });
        // 腿垂下
        b.legs.forEach(l => {
          l.hipJoint.rotation.x = 0.30;
          l.thigh.rotation.x = -0.55;
          l.shin.rotation.x = 1.15;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 2) + 1) / 2;
        b.arms.forEach(a => {
          a.fore.rotation.x = -1.15 + p * 1.15;
          a.upper.rotation.x = -0.30 + p * 0.22;
        });
        // 杠铃跟着手走
        if (b._bar) {
          b._bar.position.y = 0.98 + p * 0.20;
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
          a.upper.rotation.x = 0.15;
          a.fore.rotation.x = -0.65;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.6) + 1) / 2;
        const depth = p * 0.85;
        b.legs.forEach(l => {
          l.hipJoint.rotation.x = depth * 1.05;
          l.thigh.rotation.x = -depth * 2.0;
          l.shin.rotation.x = depth * 1.9;
        });
        b.root.position.y = -depth * 0.30;
        b.parts.torso.rotation.x = depth * 0.30;
        b.parts.waist.rotation.x = depth * 0.30;
        // 杠铃随身体下沉
        if (b._bar) {
          b._bar.position.y = 0.98 - depth * 0.30;
          b._bar.visible = true;
        }
      },
    },
    /* 划船 / 硬拉：髋主导 */
    hinge: {
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.x = 0.30;
          a.upper.rotation.x = 0.18;
          a.fore.rotation.x = -0.30;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.5) + 1) / 2;
        const bend = p * 1.0;
        b.legs.forEach(l => {
          l.hipJoint.rotation.x = bend * 0.55;
          l.thigh.rotation.x = -bend * 0.7;
          l.shin.rotation.x = bend * 0.5;
        });
        b.parts.torso.rotation.x = bend * 0.75;
        b.parts.waist.rotation.x = bend * 0.4;
        b.arms.forEach(a => { a.shoulder.rotation.x = 0.30 + bend * 0.45; });
        if (b._bar) {
          b._bar.position.y = 0.52 - bend * 0.12;
          b._bar.visible = true;
        }
      },
    },
    /* 弯举 */
    curl: {
      props: 'dumbbell',
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.x = 0;
          a.shoulder.rotation.z = a.side * 0.14;
          a.upper.rotation.x = 0.06;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 2.4) + 1) / 2;
        b.arms.forEach(a => {
          a.fore.rotation.x = -p * 2.05;
        });
      },
    },
    /* 推举 */
    press: {
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * 0.30;
          a.shoulder.rotation.x = -0.18;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.8) + 1) / 2;
        b.arms.forEach(a => {
          a.shoulder.rotation.x = -0.18 - p * 2.25;
          a.fore.rotation.x = -p * 0.32;
        });
        if (b._bar) {
          b._bar.position.y = 1.02 + p * 0.42;
          b._bar.visible = true;
        }
      },
    },
    /* 引体 / 下拉 */
    pulldown: {
      pose: b => {
        b.arms.forEach(a => {
          a.shoulder.rotation.z = a.side * 0.48;
          a.shoulder.rotation.x = -2.55;
        });
      },
      tick: (b, t) => {
        const p = (Math.sin(t * 1.7) + 1) / 2;
        b.arms.forEach(a => {
          a.shoulder.rotation.x = -2.55 + p * 1.05;
          a.fore.rotation.x = -0.28 + p * 0.45;
        });
      },
    },
    /* 卷腹 */
    crunch: {
      pose: b => {
        b.root.rotation.x = -Math.PI / 2;
        b.root.position.set(0, 0.42, 0);
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
        const p = (Math.sin(t * 2) + 1) / 2;
        b.parts.torso.rotation.x = -p * 0.48;
        b.parts.waist.rotation.x = -p * 0.24;
      },
    },
    /* 默认：站立呼吸 */
    idle: {
      pose: () => {},
      tick: (b, t) => {
        const p = Math.sin(t * 0.9);
        b.root.position.y = p * 0.008;
        b.parts.torso.rotation.z = p * 0.012;
      },
    },
  };

  /* 根据动作名判断用哪个动画 */
  function pickAnim(exName) {
    const n = exName || '';
    if (/卧推|飞鸟|臂屈伸|俯卧撑|夹胸/.test(n)) return 'bench';
    if (/深蹲|腿举|分腿蹲|腿屈伸|提踵|臀推|外展/.test(n)) return 'squat';
    if (/硬拉|划船|罗马尼亚/.test(n)) return 'hinge';
    if (/弯举/.test(n)) return 'curl';
    if (/推举|平举|面拉/.test(n)) return 'press';
    if (/引体|下拉|下压/.test(n)) return 'pulldown';
    if (/卷腹|举腿|平板|转体|死虫/.test(n)) return 'crunch';
    return 'idle';
  }

  /* ============================================================
     查看器：创建场景 / 相机 / 灯光 / 渲染循环
     ============================================================ */
  function createViewer(container, opts) {
    const { height = 300, autoRotate = true } = opts || {};

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.55, 2.5);
    camera.lookAt(0, 0.52, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';

    /* 灯光：三点布光（主光白 + 侧光微暖 + 轮廓光） */
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(1.6, 2.6, 2.2);
    key.castShadow = true;
    key.shadow.mapSize.width = 1024;
    key.shadow.mapSize.height = 1024;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 8;
    key.shadow.camera.left = -1.2;
    key.shadow.camera.right = 1.2;
    key.shadow.camera.top = 1.6;
    key.shadow.camera.bottom = -0.6;
    key.shadow.bias = -0.0012;
    scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-2, 1.4, 1.4);
    scene.add(fill);

    /* 轮廓光：从背后打，勾出身体边缘，用中性白避免染地板 */
    const rim = new THREE.DirectionalLight(0xffffff, 0.85);
    rim.position.set(-0.6, 1.6, -2.2);
    scene.add(rim);

    /* 半球光：上白下灰，模拟室内环境，不会染粉 */
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9a9a9a, 0.75));

    /* 地面（浅灰地板，接收阴影） */
    scene.add(buildFloor());

    const body = buildBody();
    scene.add(body.root);

    /* 器械：默认隐藏，按动画切换 */
    const props = {
      bench: buildBench(),
      rack: buildSquatRack(),
    };
    Object.values(props).forEach(p => { p.visible = false; scene.add(p); });

    /* 杠铃：挂在 body 上，由动画驱动位置 */
    const bar = buildBarbell(0.92, 0.115);
    bar.visible = false;
    body.root.add(bar);
    body._bar = bar;
    // 杠铃要跟随身体旋转，所以放到 root 之外单独加场景
    body.root.remove(bar);
    scene.add(bar);
    body._bar = bar;

    function setProps(key) {
      Object.entries(props).forEach(([k, p]) => { p.visible = (k === key); });
    }
    setProps(null);

    /* 自适应尺寸 */
    function resize() {
      const w = container.clientWidth || 300;
      const h = height;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    /* 渲染循环 */
    let animKey = 'idle';
    let playing = true;
    let t0 = performance.now();
    let raf = null;
    let dragging = false, lastX = 0, rotY = 0;

    function loop(now) {
      raf = requestAnimationFrame(loop);
      const t = (now - t0) / 1000;

      if (playing && ANIMS[animKey] && ANIMS[animKey].tick) {
        ANIMS[animKey].tick(body, t);
      }
      if (autoRotate && !dragging) {
        rotY += 0.004;
      }
      body.root.rotation.y = rotY;
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(loop);

    /* 拖拽旋转 */
    const dom = renderer.domElement;
    dom.style.touchAction = 'pan-y';
    const onDown = e => { dragging = true; lastX = (e.touches ? e.touches[0].clientX : e.clientX); };
    const onMove = e => {
      if (!dragging) return;
      const x = (e.touches ? e.touches[0].clientX : e.clientX);
      rotY += (x - lastX) * 0.01;
      lastX = x;
      if (e.touches) e.preventDefault();
    };
    const onUp = () => { dragging = false; };
    dom.addEventListener('mousedown', onDown);
    global.addEventListener('mousemove', onMove);
    global.addEventListener('mouseup', onUp);
    dom.addEventListener('touchstart', onDown, { passive: true });
    dom.addEventListener('touchmove', onMove, { passive: false });
    dom.addEventListener('touchend', onUp);

    return {
      scene, camera, renderer, body,
      setAnim(key) {
        if (!ANIMS[key]) return;
        animKey = key;

        // 重置姿态
        body.root.rotation.set(0, 0, 0);
        body.root.position.set(0, 0, 0);
        body.parts.torso.rotation.set(0, 0, 0);
        body.parts.waist.rotation.set(0, 0, 0);
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

        // 器械
        setProps(ANIMS[key].props || null);

        // 杠铃：只在推/蹲/拉/举这几类里出现
        bar.visible = ['bench', 'squat', 'hinge', 'press'].includes(key);

        if (ANIMS[key].pose) ANIMS[key].pose(body);
        t0 = performance.now();
      },
      setPlaying(v) { playing = v; },
      highlight(m, o) { highlight(body, m, o); },
      heatmap(d) { heatmap(body, d); },
      resetView() { rotY = 0; },
      dispose() {
        cancelAnimationFrame(raf);
        ro.disconnect();
        global.removeEventListener('mousemove', onMove);
        global.removeEventListener('mouseup', onUp);
        renderer.dispose();
        container.innerHTML = '';
      },
    };
  }

  global.Norg3D = {
    ensureThree, createViewer, buildBody, highlight, heatmap,
    pickAnim, ANIMS, get THREE() { return THREE; },
  };
})(window);
