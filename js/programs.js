/* ============================================================
   Norg · 计划库（Programs）
   ------------------------------------------------------------
   设计原则：
   1. 可选 —— 多套计划，用户自己挑，不强迫
   2. 分阶段 —— 新手有 4 周渐进，不是一上来就全套
   3. 动作固定 —— 指定具体动作，不随机抽，保证可学可复现
   4. 有替代 —— 每个难动作给新手替代方案
   5. 有教学 —— 每个阶段说明重点
   ============================================================ */
(function (global) {
  'use strict';

  /* 动作库：延迟取（脚本加载顺序可能不同） */
  const EXS = () => global.NORG_DATA.EXERCISES;
  /* ============================================================
     动作元数据：难度 + 新手替代 + 关键提示
     diff: 1=容易 2=中等 3=较难
     ============================================================ */
  const EX_META = {
    // ---- 胸 ----
    '俯卧撑': { diff: 1, alt: '跪姿俯卧撑 / 上斜俯卧撑（手撑桌沿）', tip: '身体成一条直线，肘部约 45°，不要塌腰' },
    '哑铃平板卧推': { diff: 1, alt: '器械推胸', tip: '哑铃下放到胸侧，肩胛骨收紧贴凳' },
    '杠铃平板卧推': { diff: 2, alt: '哑铃平板卧推 / 器械推胸', tip: '大重量务必有保护，肩胛后缩下沉' },
    '上斜哑铃卧推': { diff: 2, alt: '上斜器械推胸', tip: '凳面 30°，哑铃在锁骨上方' },
    '上斜杠铃卧推': { diff: 3, alt: '上斜哑铃卧推', tip: '角度越高越偏肩，建议 30°' },
    '双杠臂屈伸': { diff: 3, alt: '器械臂屈伸 / 弹力带辅助', tip: '肩部有不适就换动作，别硬撑' },
    '绳索夹胸': { diff: 1, alt: '蝴蝶机夹胸', tip: '手肘微屈固定，用胸把手臂"抱"过来' },
    '上斜哑铃飞鸟': { diff: 2, alt: '蝴蝶机夹胸', tip: '重量宜轻，感受胸肌拉伸' },

    // ---- 背 ----
    '高位下拉': { diff: 1, alt: '弹力带下拉', tip: '拉至锁骨，肩胛先下沉再发力' },
    '坐姿绳索划船': { diff: 1, alt: '器械划船', tip: '拉向腹部，肩胛后缩，别用腰甩' },
    '单臂哑铃划船': { diff: 1, alt: '坐姿绳索划船', tip: '背部与地面平行，拉向腰际' },
    '杠铃划船': { diff: 2, alt: '单臂哑铃划船 / 器械划船', tip: '俯身 45°，背部中立不圆背' },
    '引体向上': { diff: 3, alt: '弹力带辅助引体 / 高位下拉', tip: '想象用肘部向下"插"' },
    '直臂下压': { diff: 1, alt: '—', tip: '手肘角度固定，只动肩关节' },
    '硬拉': { diff: 3, alt: '罗马尼亚硬拉（轻重量）/ 髋铰链练习', tip: '腰背酸痛立即停，动作质量优先' },
    '面拉': { diff: 1, alt: '弹力带面拉', tip: '重量宜轻，拉向面部时双手外旋' },

    // ---- 肩 ----
    '哑铃坐姿推举': { diff: 1, alt: '器械肩推', tip: '下放至肘略低于肩即可' },
    '杠铃站姿推举': { diff: 3, alt: '哑铃坐姿推举', tip: '核心收紧，避免腰过度后弯' },
    '哑铃侧平举': { diff: 1, alt: '弹力带侧平举', tip: '重量宁轻勿重，避免耸肩' },
    '哑铃前平举': { diff: 1, alt: '—', tip: '抬至肩高，控制下放' },
    '俯身飞鸟': { diff: 2, alt: '反向蝴蝶机', tip: '用肩胛骨"夹"，不是用手抬' },
    '绳索侧平举': { diff: 2, alt: '哑铃侧平举', tip: '保持躯干稳定不侧倾' },

    // ---- 手臂 ----
    '哑铃交替弯举': { diff: 1, alt: '弹力带弯举', tip: '弯举时前臂外旋，顶峰停 1 秒' },
    '锤式弯举': { diff: 1, alt: '—', tip: '掌心相对，肘部固定在体侧' },
    '杠铃弯举': { diff: 2, alt: '哑铃交替弯举', tip: '手肘不要前后摆动' },
    '牧师凳弯举': { diff: 2, alt: '器械弯举', tip: '下放至接近伸直但不锁死' },
    '绳索下压': { diff: 1, alt: '弹力带下压', tip: '只动前臂，上臂贴紧体侧' },
    '仰卧臂屈伸': { diff: 2, alt: '绳索下压', tip: '手肘保持朝上不外张' },
    '窄距卧推': { diff: 2, alt: '绳索下压', tip: '握距与肩同宽，肘部贴近身体' },
    '腕弯举': { diff: 1, alt: '—', tip: '小重量高次数效果更好' },

    // ---- 腿 ----
    '腿举': { diff: 1, alt: '—', tip: '下放至膝约 90°，不要抬臀' },
    '腿屈伸': { diff: 1, alt: '—', tip: '伸膝至接近伸直，顶峰收缩' },
    '腿弯举': { diff: 1, alt: '—', tip: '离心阶段控制 3 秒' },
    '髋外展': { diff: 1, alt: '弹力带侧向行走', tip: '身体前倾可增加臀中肌参与' },
    '站姿提踵': { diff: 1, alt: '台阶提踵（自重）', tip: '顶峰停 1 秒，避免弹震' },
    '坐姿提踵': { diff: 1, alt: '—', tip: '比目鱼肌以慢肌为主，宜高次数' },
    '臀推': { diff: 2, alt: '臀桥（自重）', tip: '顶峰挤压臀部 1 秒，别用腰顶' },
    '杠铃深蹲': { diff: 3, alt: '高脚杯深蹲（哑铃）/ 腿举 / 史密斯深蹲', tip: '膝盖与脚尖同向，别内扣' },
    '前蹲': { diff: 3, alt: '高脚杯深蹲', tip: '肘部高抬，躯干保持直立' },
    '罗马尼亚硬拉': { diff: 2, alt: '腿弯举 / 髋铰链练习', tip: '髋部后推，杠铃贴腿下放' },
    '保加利亚分腿蹲': { diff: 3, alt: '分腿蹲（后脚不抬高）/ 箭步蹲', tip: '重心放前腿，后腿只支撑' },

    // ---- 核心 ----
    '卷腹': { diff: 1, alt: '—', tip: '下背贴地，用腹把肩胛卷起' },
    '平板支撑': { diff: 1, alt: '跪姿平板', tip: '宁可 40 秒标准，不要 90 秒塌腰' },
    '死虫': { diff: 1, alt: '—', tip: '动作越慢越有效，腰要贴地' },
    '俄罗斯转体': { diff: 2, alt: '—', tip: '转动来自躯干而非手臂' },
    '绳索卷腹': { diff: 2, alt: '卷腹', tip: '髋角固定，只做脊柱屈曲' },
    '悬垂举腿': { diff: 3, alt: '仰卧举腿 / 屈膝举腿', tip: '避免身体前后摆动借力' },

    // ---- 有氧 ----
    '跑步机慢跑': { diff: 1, alt: '快走 / 椭圆机', tip: '能说话但不能唱歌的强度' },
    '动感单车': { diff: 1, alt: '—', tip: '座高调到踩到底膝盖微屈' },
    '跳绳': { diff: 2, alt: '原地高抬腿', tip: '前脚掌落地，分组进行' },
  };

  /* 高脚杯深蹲不在动作库里，用哑铃深蹲替代 —— 加个虚拟动作映射 */
  const VIRTUAL = {
    '高脚杯深蹲': { base: '杠铃深蹲', label: '高脚杯深蹲（哑铃）' },
    '臀桥': { base: '臀推', label: '臀桥（自重）' },
    '分腿蹲': { base: '保加利亚分腿蹲', label: '分腿蹲（后脚不抬）' },
    '跪姿俯卧撑': { base: '俯卧撑', label: '跪姿俯卧撑' },
    '仰卧举腿': { base: '悬垂举腿', label: '仰卧举腿' },
  };

  /* ============================================================
     计划库
     sessions[].blocks = [动作名, 组数, 次数]
     ============================================================ */
  const PROGRAMS = [

    /* ---------- 1. 新手入门 4 周（默认推荐） ---------- */
    {
      id: 'starter4w',
      name: '新手入门 · 4 周',
      badge: '推荐新手',
      level: 'beginner',
      days: 3,
      weeks: 4,
      equipment: 'all',
      desc: '从零开始。前两周只学动作、用轻重量，第三周才开始加负荷。动作都是最基础、最容易上手的。',
      phases: [
        {
          weeks: [1, 2], name: '第 1-2 周 · 学动作',
          note: '重点是「把动作做对」，不是练到力竭。每组结束应该还能再做 3-4 次。重量选你能轻松控制的。',
          rpe: '5-6', setMul: 0.65, repBonus: 2,
        },
        {
          weeks: [3, 4], name: '第 3-4 周 · 加负荷',
          note: '动作熟练后开始增加重量。每组结束还能再做 1-2 次。如果动作变形就立刻减重。',
          rpe: '7', setMul: 0.9, repBonus: 0,
        },
      ],
      sessions: [
        {
          key: 'A', label: '全身 A', focus: ['chest', 'back', 'quads', 'abs'],
          blocks: [
            ['高脚杯深蹲', 3, 10],
            ['哑铃平板卧推', 3, 10],
            ['高位下拉', 3, 12],
            ['哑铃侧平举', 2, 15],
            ['平板支撑', 3, '30秒'],
          ],
        },
        {
          key: 'B', label: '全身 B', focus: ['back', 'shoulders', 'hams', 'abs'],
          blocks: [
            ['腿举', 3, 12],
            ['坐姿绳索划船', 3, 12],
            ['哑铃坐姿推举', 3, 10],
            ['腿弯举', 3, 12],
            ['卷腹', 3, 15],
          ],
        },
        {
          key: 'C', label: '全身 C', focus: ['chest', 'back', 'glutes', 'calves'],
          blocks: [
            ['臀桥', 3, 15],
            ['跪姿俯卧撑', 3, 10],
            ['单臂哑铃划船', 3, 12],
            ['哑铃交替弯举', 2, 12],
            ['站姿提踵', 3, 20],
          ],
        },
      ],
    },

    /* ---------- 2. 全身基础 3 天 ---------- */
    {
      id: 'fullbody3',
      name: '全身基础 · 3 天',
      badge: '省时高效',
      level: 'beginner',
      days: 3,
      weeks: 8,
      equipment: 'all',
      desc: '每周 3 练，每次全身。研究显示新手用全身训练进步最快，每个部位一周练到 3 次。',
      phases: [
        { weeks: [1, 4], name: '第 1-4 周 · 建立基础', note: '固定动作、稳定加重。每次训练比上次多 1-2 次或多 2.5kg。', rpe: '7', setMul: 0.85, repBonus: 0 },
        { weeks: [5, 8], name: '第 5-8 周 · 增加容量', note: '每个动作加一组，或加一个孤立动作。', rpe: '8', setMul: 1.1, repBonus: 0 },
      ],
      sessions: [
        {
          key: 'A', label: '全身 A', focus: ['quads', 'chest', 'back'],
          blocks: [
            ['腿举', 3, 10],
            ['哑铃平板卧推', 3, 10],
            ['高位下拉', 3, 10],
            ['腿弯举', 3, 12],
            ['绳索下压', 2, 12],
          ],
        },
        {
          key: 'B', label: '全身 B', focus: ['hams', 'shoulders', 'back'],
          blocks: [
            ['罗马尼亚硬拉', 3, 10],
            ['哑铃坐姿推举', 3, 10],
            ['坐姿绳索划船', 3, 10],
            ['腿屈伸', 3, 12],
            ['哑铃交替弯举', 2, 12],
          ],
        },
        {
          key: 'C', label: '全身 C', focus: ['glutes', 'chest', 'abs'],
          blocks: [
            ['臀推', 3, 12],
            ['俯卧撑', 3, 10],
            ['单臂哑铃划船', 3, 12],
            ['哑铃侧平举', 3, 15],
            ['卷腹', 3, 15],
          ],
        },
      ],
    },

    /* ---------- 3. 哑铃居家 3 天 ---------- */
    {
      id: 'dumbbell3',
      name: '哑铃居家 · 3 天',
      badge: '只需一对哑铃',
      level: 'beginner',
      days: 3,
      weeks: 8,
      equipment: '哑铃',
      desc: '只要一对哑铃就能练全身。适合在家、宿舍、出差。',
      phases: [
        { weeks: [1, 4], name: '第 1-4 周 · 熟悉', note: '用能控制住的重量，重点感受目标肌肉。', rpe: '7', setMul: 0.85, repBonus: 0 },
        { weeks: [5, 8], name: '第 5-8 周 · 进阶', note: '加重或加次数，也可以放慢离心速度（下放 3 秒）。', rpe: '8', setMul: 1.0, repBonus: 2 },
      ],
      sessions: [
        {
          key: 'A', label: '上肢推 + 下肢', focus: ['chest', 'shoulders', 'quads'],
          blocks: [
            ['哑铃平板卧推', 4, 10],
            ['哑铃坐姿推举', 3, 10],
            ['哑铃侧平举', 3, 15],
            ['高脚杯深蹲', 3, 12],
            ['站姿提踵', 3, 20],
          ],
        },
        {
          key: 'B', label: '上肢拉 + 下肢', focus: ['back', 'biceps', 'hams'],
          blocks: [
            ['单臂哑铃划船', 4, 12],
            ['俯身飞鸟', 3, 15],
            ['哑铃交替弯举', 3, 12],
            ['罗马尼亚硬拉', 3, 12],
            ['卷腹', 3, 15],
          ],
        },
        {
          key: 'C', label: '全身综合', focus: ['chest', 'back', 'glutes'],
          blocks: [
            ['哑铃平板卧推', 3, 12],
            ['单臂哑铃划船', 3, 12],
            ['臀桥', 3, 15],
            ['锤式弯举', 2, 12],
            ['平板支撑', 3, '45秒'],
          ],
        },
      ],
    },

    /* ---------- 4. 自重无器械 3 天 ---------- */
    {
      id: 'bodyweight3',
      name: '自重无器械 · 3 天',
      badge: '啥都不用买',
      level: 'beginner',
      days: 3,
      weeks: 6,
      equipment: '自重',
      desc: '不用任何器械，家里一块空地就能练。靠调整角度和次数来渐进。',
      phases: [
        { weeks: [1, 3], name: '第 1-3 周 · 建立', note: '先能做标准动作，做不动就用跪姿/上斜版本。', rpe: '7', setMul: 0.8, repBonus: 0 },
        { weeks: [4, 6], name: '第 4-6 周 · 加难', note: '增加次数，或换更难的角度（脚抬高、单腿）。', rpe: '8', setMul: 1.0, repBonus: 3 },
      ],
      sessions: [
        {
          key: 'A', label: '推 · 核心', focus: ['chest', 'shoulders', 'abs'],
          blocks: [
            ['俯卧撑', 4, 10],
            ['平板支撑', 3, '45秒'],
            ['卷腹', 3, 15],
            ['死虫', 3, 12],
          ],
        },
        {
          key: 'B', label: '腿 · 臀', focus: ['quads', 'glutes', 'calves'],
          blocks: [
            ['分腿蹲', 3, 12],
            ['臀桥', 4, 15],
            ['站姿提踵', 3, 20],
            ['平板支撑', 3, '45秒'],
          ],
        },
        {
          key: 'C', label: '拉 · 核心', focus: ['back', 'abs'],
          blocks: [
            ['仰卧举腿', 3, 12],
            ['俄罗斯转体', 3, 20],
            ['死虫', 3, 12],
            ['平板支撑', 3, '60秒'],
          ],
        },
      ],
    },

    /* ---------- 5. 臀腿塑形 3 天 ---------- */
    {
      id: 'glutes3',
      name: '臀腿塑形 · 3 天',
      badge: '下肢重点',
      level: 'beginner',
      days: 3,
      weeks: 8,
      equipment: 'all',
      desc: '以下肢和臀部为主，上肢维持。适合想改善臀型、腿型的人。',
      phases: [
        { weeks: [1, 4], name: '第 1-4 周 · 找发力', note: '臀部动作先学会「用臀不用腰」，重量轻一点没关系。', rpe: '7', setMul: 0.85, repBonus: 0 },
        { weeks: [5, 8], name: '第 5-8 周 · 加容量', note: '臀腿各加一组，重量渐进。', rpe: '8', setMul: 1.15, repBonus: 0 },
      ],
      sessions: [
        {
          key: 'A', label: '臀 · 后链', focus: ['glutes', 'hams', 'back'],
          blocks: [
            ['臀推', 4, 12],
            ['罗马尼亚硬拉', 3, 12],
            ['髋外展', 3, 20],
            ['腿弯举', 3, 15],
            ['面拉', 2, 15],
          ],
        },
        {
          key: 'B', label: '腿 · 前链', focus: ['quads', 'glutes', 'calves'],
          blocks: [
            ['高脚杯深蹲', 4, 12],
            ['腿举', 3, 12],
            ['腿屈伸', 3, 15],
            ['站姿提踵', 4, 20],
            ['卷腹', 3, 15],
          ],
        },
        {
          key: 'C', label: '臀 · 综合', focus: ['glutes', 'quads', 'abs'],
          blocks: [
            ['臀桥', 4, 20],
            ['分腿蹲', 3, 12],
            ['髋外展', 3, 20],
            ['哑铃侧平举', 3, 15],
            ['平板支撑', 3, '45秒'],
          ],
        },
      ],
    },

    /* ---------- 6. 推拉腿 3 天 ---------- */
    {
      id: 'ppl3',
      name: '推拉腿 · 3 天',
      badge: '中阶经典',
      level: 'intermediate',
      days: 3,
      weeks: 8,
      equipment: 'all',
      desc: '推 / 拉 / 腿各一次，最经典的中阶分化。每个部位一周练一次，但强度高。',
      phases: [
        { weeks: [1, 4], name: '第 1-4 周 · 积累', note: '每组留 2 次余力，稳步加重。', rpe: '7-8', setMul: 0.9, repBonus: 0 },
        { weeks: [5, 8], name: '第 5-8 周 · 强化', note: '主项加一组，孤立动作加到 4 组。', rpe: '8-9', setMul: 1.1, repBonus: 0 },
      ],
      sessions: [
        {
          key: 'push', label: '推日 · 胸肩三头', focus: ['chest', 'shoulders', 'triceps'],
          blocks: [
            ['杠铃平板卧推', 4, 8],
            ['上斜哑铃卧推', 3, 10],
            ['哑铃侧平举', 3, 15],
            ['绳索下压', 3, 12],
            ['绳索夹胸', 2, 15],
          ],
        },
        {
          key: 'pull', label: '拉日 · 背二头', focus: ['back', 'biceps', 'traps'],
          blocks: [
            ['高位下拉', 4, 10],
            ['杠铃划船', 4, 8],
            ['坐姿绳索划船', 3, 12],
            ['面拉', 3, 15],
            ['哑铃交替弯举', 3, 12],
          ],
        },
        {
          key: 'legs', label: '腿日 · 下肢核心', focus: ['quads', 'hams', 'glutes', 'calves'],
          blocks: [
            ['杠铃深蹲', 4, 8],
            ['罗马尼亚硬拉', 3, 10],
            ['腿举', 3, 12],
            ['腿弯举', 3, 12],
            ['站姿提踵', 4, 15],
          ],
        },
      ],
    },

    /* ---------- 7. 上下肢 4 天 ---------- */
    {
      id: 'ul4',
      name: '上下肢 · 4 天',
      badge: '频率最优',
      level: 'intermediate',
      days: 4,
      weeks: 8,
      equipment: 'all',
      desc: '上肢 / 下肢各两次。每个部位一周练两次，频率与容量平衡最好。',
      phases: [
        { weeks: [1, 4], name: '第 1-4 周 · 力量为主', note: 'A 日偏力量（重、少次数），B 日偏增肌（轻、多次数）。', rpe: '7-8', setMul: 0.95, repBonus: 0 },
        { weeks: [5, 8], name: '第 5-8 周 · 增肌为主', note: '全部转为 8-12 次区间，容量拉满。', rpe: '8', setMul: 1.15, repBonus: 2 },
      ],
      sessions: [
        {
          key: 'u1', label: '上肢 A · 力量', focus: ['chest', 'back', 'shoulders'], strength: true,
          blocks: [
            ['杠铃平板卧推', 4, 6],
            ['杠铃划船', 4, 6],
            ['哑铃坐姿推举', 3, 8],
            ['高位下拉', 3, 8],
            ['绳索下压', 3, 10],
          ],
        },
        {
          key: 'l1', label: '下肢 A · 力量', focus: ['quads', 'hams', 'glutes'], strength: true,
          blocks: [
            ['杠铃深蹲', 4, 6],
            ['罗马尼亚硬拉', 3, 8],
            ['腿举', 3, 10],
            ['站姿提踵', 4, 12],
          ],
        },
        {
          key: 'u2', label: '上肢 B · 增肌', focus: ['chest', 'back', 'biceps', 'triceps'],
          blocks: [
            ['上斜哑铃卧推', 4, 10],
            ['坐姿绳索划船', 4, 10],
            ['哑铃侧平举', 4, 15],
            ['哑铃交替弯举', 3, 12],
            ['绳索下压', 3, 15],
          ],
        },
        {
          key: 'l2', label: '下肢 B · 增肌', focus: ['quads', 'hams', 'calves', 'abs'],
          blocks: [
            ['腿举', 4, 12],
            ['腿弯举', 4, 12],
            ['保加利亚分腿蹲', 3, 10],
            ['坐姿提踵', 4, 20],
            ['卷腹', 3, 15],
          ],
        },
      ],
    },

    /* ---------- 8. 五分化 5 天 ---------- */
    {
      id: 'pplul5',
      name: '五分化 · 5 天',
      badge: '进阶',
      level: 'advanced',
      days: 5,
      weeks: 8,
      equipment: 'all',
      desc: '每周 5 练，适合有 1 年以上基础、恢复能力好的人。每个部位练得很透。',
      phases: [
        { weeks: [1, 4], name: '第 1-4 周', note: '大重量复合动作在前，孤立动作在后。', rpe: '8', setMul: 1.0, repBonus: 0 },
        { weeks: [5, 8], name: '第 5-8 周', note: '容量拉高，注意睡眠和恢复。第 8 周安排减载。', rpe: '8-9', setMul: 1.2, repBonus: 0 },
      ],
      sessions: [
        {
          key: 'push', label: '推日 · 胸', focus: ['chest', 'triceps'],
          blocks: [
            ['杠铃平板卧推', 4, 8],
            ['上斜杠铃卧推', 4, 8],
            ['绳索夹胸', 3, 15],
            ['双杠臂屈伸', 3, 10],
            ['绳索下压', 3, 12],
          ],
        },
        {
          key: 'pull', label: '拉日 · 背', focus: ['back', 'biceps'],
          blocks: [
            ['引体向上', 4, 8],
            ['杠铃划船', 4, 8],
            ['高位下拉', 3, 12],
            ['直臂下压', 3, 15],
            ['杠铃弯举', 3, 12],
          ],
        },
        {
          key: 'legs', label: '腿日', focus: ['quads', 'hams', 'glutes'],
          blocks: [
            ['杠铃深蹲', 4, 8],
            ['腿举', 4, 12],
            ['罗马尼亚硬拉', 3, 10],
            ['腿弯举', 3, 12],
            ['站姿提踵', 4, 15],
          ],
        },
        {
          key: 'shoulders', label: '肩 · 手臂', focus: ['shoulders', 'biceps', 'triceps'],
          blocks: [
            ['哑铃坐姿推举', 4, 10],
            ['哑铃侧平举', 4, 15],
            ['俯身飞鸟', 4, 15],
            ['哑铃交替弯举', 3, 12],
            ['仰卧臂屈伸', 3, 12],
          ],
        },
        {
          key: 'upper', label: '上肢综合', focus: ['chest', 'back', 'abs'],
          blocks: [
            ['上斜哑铃卧推', 3, 12],
            ['坐姿绳索划船', 3, 12],
            ['高位下拉', 3, 12],
            ['面拉', 3, 15],
            ['悬垂举腿', 3, 12],
          ],
        },
      ],
    },
  ];

  /* ============================================================
     工具函数
     ============================================================ */

  /* 解析动作名 → 动作库条目（支持虚拟动作） */
  function resolveExercise(name) {
    const list = EXS();
    let ex = list.find(e => e.name === name);
    if (ex) return { ex, label: name, virtual: false };

    const v = VIRTUAL[name];
    if (v) {
      const base = list.find(e => e.name === v.base);
      if (base) return { ex: base, label: v.label, virtual: true };
    }
    return null;
  }

  /* 取动作元数据 */
  function metaOf(name) {
    const v = VIRTUAL[name];
    return EX_META[name] || (v ? EX_META[v.base] : null) || { diff: 2, alt: '', tip: '' };
  }

  /* 难度标签 */
  function diffLabel(d) {
    return d === 1 ? '容易' : d === 3 ? '较难' : '中等';
  }
  function diffColor(d) {
    return d === 1 ? '#3ddc84' : d === 3 ? '#ff9f43' : '#4fd1e0';
  }

  /* 当前处于第几阶段 */
  function phaseOf(program, weekIndex) {
    const ph = program.phases || [];
    for (const p of ph) {
      if (weekIndex >= p.weeks[0] && weekIndex <= p.weeks[1]) return p;
    }
    return ph[ph.length - 1] || null;
  }

  /* 计算目标重量（新手用体重估算，有纪录按 e1RM） */
  function targetWeight(ex, pr, profile, phase, displayName) {
    const rpe = phase ? phase.rpe : '7';
    // RPE 越低（学动作阶段），重量越轻
    const rpeFactor = rpe === '5-6' ? 0.72 : rpe === '7' ? 0.85 : 0.95;

    // 用「显示名」判断真实器械（虚拟动作的 base 可能是杠铃）
    const n = displayName || ex.name;
    const isDumbbell = /哑铃|高脚杯/.test(n);

    if (pr && pr.e1rm > 0 && !isDumbbell) {
      const pct = 1 / (1 + 10 / 30);
      const w = pr.e1rm * pct * rpeFactor;
      return roundToPlate(w, isDumbbell);
    }

    const bw = profile.weight || 70;
    const f = estimateFactorByName(n, ex.equip);
    if (f === 0) return 0;
    const est1rm = bw * f;
    const w = est1rm * 0.55 * rpeFactor;
    return roundToPlate(w, isDumbbell);
  }

  /* 按器械取整：杠铃 2.5kg 一跳，哑铃 1kg 一跳 */
  function roundToPlate(w, isDumbbell) {
    if (w <= 0) return 0;
    const step = isDumbbell ? 1 : 2.5;
    const r = Math.round(w / step) * step;
    const cap = isDumbbell ? 40 : 200;
    return Math.max(step, Math.min(r, cap));
  }

  /* 按动作名 + 器械估算 1RM / 体重 的系数 */
  function estimateFactorByName(n, equip) {
    // 自重动作：永远不加重量（臀桥、分腿蹲、俯卧撑等）
    if (equip === '自重' || equip === '有氧') return 0;
    if (/^臀桥|^分腿蹲|^跪姿|^仰卧举腿|^俯卧撑|^卷腹|^平板|^死虫|^俄罗斯|^悬垂|^引体|^双杠/.test(n)) return 0;

    const isDb = /哑铃|高脚杯/.test(n);

    if (isDb) {
      // 哑铃是单手重量
      if (/高脚杯|深蹲/.test(n)) return 0.28;
      if (/卧推/.test(n)) return 0.24;
      if (/推举/.test(n)) return 0.17;
      if (/划船/.test(n)) return 0.26;
      if (/弯举|侧平举|飞鸟|前平举/.test(n)) return 0.09;
      if (/罗马尼亚|硬拉/.test(n)) return 0.30;
      return 0.18;
    }

    // 杠铃 / 器械 / 绳索：总重量
    if (/深蹲/.test(n)) return 0.75;
    if (/硬拉/.test(n) && !/罗马尼亚/.test(n)) return 0.90;
    if (/罗马尼亚/.test(n)) return 0.65;
    if (/腿举/.test(n)) return 1.60;
    if (/卧推/.test(n) && /杠铃/.test(n)) return 0.60;
    if (/卧推/.test(n)) return 0.35;
    if (/推举/.test(n)) return 0.35;
    // 杠铃划船必须排在通用"划船"之前
    if (/杠铃划船/.test(n)) return 0.62;
    if (/划船|下拉/.test(n)) return 0.62;
    if (/臀推/.test(n)) return 0.60;
    if (/腿弯举|腿屈伸/.test(n)) return 0.35;
    if (/提踵/.test(n)) return 0.60;
    if (/夹胸|下压|面拉/.test(n)) return 0.22;
    if (/弯举|侧平举|飞鸟|前平举/.test(n)) return 0.12;
    return 0.20;
  }

  /* 兼容旧调用 */
  function estimateFactor(ex) {
    return estimateFactorByName(ex.name, ex.equip);
  }

  /* ============================================================
     生成某周的计划
     ============================================================ */
  function buildWeek(programId, weekIndex, opts) {
    const S = global.NorgStore;
    const program = PROGRAMS.find(p => p.id === programId) || PROGRAMS[0];
    const profile = S.state.profile;
    const phase = phaseOf(program, weekIndex || 1);
    const setMul = phase ? phase.setMul : 1;
    const repBonus = phase ? phase.repBonus : 0;

    // 训练日分布
    const weekdayMap = distributeDays(program.days);

    const week = {
      programId: program.id,
      programName: program.name,
      phaseName: phase ? phase.name : '',
      phaseNote: phase ? phase.note : '',
      phaseRpe: phase ? phase.rpe : '',
      weekIndex: weekIndex || 1,
      totalWeeks: program.weeks,
      sessions: [],
      createdAt: Date.now(),
    };

    program.sessions.forEach((sess, i) => {
      const exercises = [];
      sess.blocks.forEach(([name, sets, reps]) => {
        const r = resolveExercise(name);
        if (!r) return;
        const meta = metaOf(name);
        const pr = S.state.prs[r.ex.id];
        const isTime = typeof reps === 'string';
        const realSets = Math.max(2, Math.round(sets * setMul));
        const realReps = isTime ? reps : reps + repBonus;

        exercises.push({
          exId: r.ex.id,
          name: r.label,
          baseName: name,
          muscle: r.ex.primary,
          targetSets: realSets,
          targetReps: realReps,
          targetWeight: isTime ? 0 : targetWeight(r.ex, pr, profile, phase, r.label),
          rest: phase && phase.rpe === '5-6' ? '60-90 s' : '90-120 s',
          difficulty: meta.diff,
          alt: meta.alt,
          tip: meta.tip,
          hasPR: !!pr,
        });
      });

      week.sessions.push({
        key: sess.key,
        label: sess.label,
        weekday: weekdayMap[i] || 1,
        focus: sess.focus,
        exercises,
        totalSets: exercises.reduce((a, e) => a + e.targetSets, 0),
      });
    });

    return week;
  }

  function distributeDays(n) {
    if (n === 2) return [1, 4];
    if (n === 3) return [1, 3, 5];
    if (n === 4) return [1, 2, 4, 5];
    if (n === 5) return [1, 2, 3, 5, 6];
    return [0, 1, 2, 3, 4, 5];
  }

  /* 计划质量自检 */
  function auditWeek(week) {
    const issues = [];
    const warnings = [];

    week.sessions.forEach(s => {
      if (!s.exercises.length) issues.push(`${s.label} 没有可用动作`);
    });

    // 新手计划检查：难动作占比
    const all = week.sessions.flatMap(s => s.exercises);
    const hard = all.filter(e => e.difficulty === 3);
    if (hard.length > all.length * 0.3) {
      warnings.push(`较难动作占 ${Math.round(hard.length / all.length * 100)}%，新手建议不超过 30%`);
    }

    // 每周训练量
    const vol = {};
    const list = EXS();
    all.forEach(e => {
      const meta = list.find(x => x.id === e.exId);
      (meta ? meta.muscles : [e.muscle]).forEach((m, i) => {
        vol[m] = (vol[m] || 0) + e.targetSets * (i === 0 ? 1 : 0.5);
      });
    });

    return {
      volume: vol,
      issues,
      warnings,
      score: Math.max(0, 100 - issues.length * 30 - warnings.length * 10),
    };
  }

  global.NorgPrograms = {
    PROGRAMS, EX_META, VIRTUAL,
    resolveExercise, metaOf, diffLabel, diffColor,
    phaseOf, buildWeek, auditWeek, distributeDays,
  };
})(window);
