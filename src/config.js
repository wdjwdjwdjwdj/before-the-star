export const RULES = Object.freeze({
  cycle: 42, charge: 4, launch: 2, ending: 10, speed: 5.4, radius: .28, interact: 2.15, outageAt: 17, outageFor: 1.8,
});
// V2 thermal loop, with the three scheme-C deltas (chargeCold / coldSeconds / recovery).
export const FE = Object.freeze({
  baseHeat: 2, baseCold: 2, max: 5, safeHeat: 4, chargeHeat: 2, chargeCold: 1, recoveryPerSecond: 0.15, coldSeconds: 5,
});
export const SWITCHES_PER_LOOP = 1;
export const SPAWN = { x: -8, z: 3.4 };
export const ROOMS = [
  { id: 'wake', name: '苏醒舱', code: 'A / HABITAT', x: -8, z: 3.5, w: 8, d: 7, color: 0x817567, accent: '#f3cf98' },
  { id: 'power', name: '能源室', code: 'B / REACTOR', x: -8, z: -3.5, w: 8, d: 7, color: 0x294753, accent: '#59dfe3' },
  { id: 'maint', name: '维护室', code: 'C / SERVICE', x: 0, z: 0, w: 8, d: 14, color: 0x344352, accent: '#8fbaef' },
  { id: 'escape', name: '逃生区', code: 'D / EGRESS', x: 8, z: 0, w: 8, d: 14, color: 0x4c4946, accent: '#f7a46b' },
];
export const WALLS = [
  { x: 0, z: -7, w: 24.4, d: .3, outer: true }, { x: 0, z: 7, w: 24.4, d: .3, outer: true },
  { x: -12, z: 0, w: .3, d: 14, outer: true }, { x: 12, z: 0, w: .3, d: 14, outer: true },
  { x: -4, z: -5.65, w: .24, d: 2.7 }, { x: -4, z: 0, w: .24, d: 3.4 }, { x: -4, z: 5.65, w: .24, d: 2.7 },
  { x: -10.7, z: 0, w: 2.6, d: .24 }, { x: -5.3, z: 0, w: 2.6, d: .24 },
  { x: 4, z: -4.25, w: .32, d: 5.5 }, { x: 4, z: 4.25, w: .32, d: 5.5 },
];
export const GATE = { x: 4, z: 0, w: .38, d: 3 };
export const PROPS = [
  { id: 'bed', x: -10.3, z: 3.7, w: 1.6, d: 2.7 },
  { id: 'reactor', x: -10.3, z: -5.4, w: 2.1, d: 2 },
  { id: 'breaker', x: -7.4, z: -5.4, w: 1.7, d: 1.1 },
  { id: 'battery', x: .1, z: -4.7, w: 2.4, d: 1.4 },
  { id: 'thermal', x: 2.25, z: -4.7, w: 1.05, d: 1.4 },
  { id: 'cryo-monitor', x: -10.8, z: 5.9, w: .85, d: .65 },
  { id: 'locker', x: -1.4, z: 5.7, w: 2.8, d: 1 },
  { id: 'pod', x: 9.2, z: -3, w: 2.7, d: 4 },
  { id: 'terminal', x: 7.3, z: 1.1, w: 1.1, d: .85 },
  { id: 'crate', x: 10.6, z: 5.4, w: 1.7, d: 1.5 },
];
export const DEVICES = [
  { id: 'breaker', name: '主电源断路器', x: -7.4, z: -4.7 },
  { id: 'battery', name: '备用电池管理装置', x: .1, z: -3.9 },
  { id: 'thermal', name: '循环温控分配器', x: 2.25, z: -3.9 },
  { id: 'gate', name: '断电释放安全门', x: 4, z: 0 },
  { id: 'terminal', name: '逃生舱发射终端', x: 7.3, z: 1.65 },
  { id: 'log-wake', name: '值守员便笺', x: -10.6, z: 1.4 },
  { id: 'log-grid', name: '维护铭牌', x: 2.8, z: 3.5 },
  { id: 'log-star', name: '观测记录', x: 10.6, z: 2.8 },
];
export const KNOWLEDGE = {
  gate: { title: '锁住门的，是电', text: '供电中安全门锁闭；停电后机械锁释放。' },
  pod: { title: '开门不等于逃离', text: '主电源断开时，逃生舱的动力仪表也熄灭了。它没有独立动力。' },
  charge: { title: '可以带走的电', text: '备用电池接入主电网后，需要四秒完成充电。' },
  drain: { title: '电流去了别处', text: '未隔离的电池在停电时向公共回路泄放，不能为逃生舱独立供电。' },
  isolate: { title: '一条独立的回路', text: '充满后执行隔离，电池只接入逃生备用回路，不再被公共设备消耗。' },
  loop: { title: '重启后的站体', text: `${RULES.cycle} 秒后，位置与电量复原。已记录的事实依然存在；热管理会在重启阶段恢复设备。` },
  heat: { title: '充电的代价', text: '备用电池充电会带来额外热负荷。能源优先可以抵消这部分热量；过热保护会停止充电。' },
  thermal: { title: '同一条冷却回路', text: '温控分配器每环只能拨一次，优先保障能源或休眠。休眠优先时充电能积累储冷，但能源设备也会变热。' },
  cold: { title: '需要被保护的乘员', text: `休眠人类依赖温度保障。有主网时储冷保持；失电累计每 ${FE.coldSeconds} 秒消耗一单位储冷，撤离完成仍需至少一单位。` },
  residual: { title: '控制重启，余热仍在', text: '余热会留下。时间回到脉冲前，热量不回到脉冲前。自动热管理每轮降低一单位余热，最低恢复到基础热负荷。' },
};
export const QUESTIONS = [
  { id: 'q_gate', prompt: '锁住门的，是电还是别的？', fact: '锁住门的，是电。供电锁闭，失电释放。' },
  { id: 'q_cold', prompt: '断闸之后，冷从哪掉？', fact: '断闸之后，冷从休眠储冷里掉。每五秒一单位，掉破 1 就拒发。' },
  { id: 'q_heat', prompt: '充电的热，谁在扛？', fact: '充电的热，能源优先由设备侧扛住；拨向休眠，就改由舱体热负荷扛。' },
  { id: 'q_residual', prompt: '时间归零后，什么没归零？', fact: '时间归零后，余热没归零。热量不回到脉冲前。' },
];
export const LOGS = {
  'log-wake': { title: '便笺 / 最后一班', text: '广播总说同一句话。床单的折痕也没有变。\n别再搬运东西。把看到的记下来。\n——值守员 07' },
  'log-grid': { title: '维护铭牌 / S-04', text: '安全门：有源锁闭 · 失电释放。\n备用模块：充电后需人工隔离。\n警告：未隔离模块会向公共母线回灌。\n温控：每环只允许改一次分配。' },
  'log-star': { title: '观测记录 / 最后一次', text: `辐射脉冲与环实验装置每 ${RULES.cycle} 秒同相。\n锚点局限于站体。离开站体，或许就能离开这 ${RULES.cycle} 秒。` },
};
export const COPY = {
  begin: '曙光站，值守周期。距离辐射回环：四十二秒。休眠舱热预算请自行核对。',
  thermalEnergy: '温控：能源回路优先。休眠侧冷源抽取下降。注意余热迁移。',
  thermalCryo: '温控：休眠储冷优先。能源侧散热窗口缩短。母线负载上升。',
  thermalLocked: '本环分配已锁定。',
  coldWarn: '储冷槽位低于安全裕度。回环后物理读数复位，槽内余热账不复位。',
  residual: '余热会留下。时间回到脉冲前，热量不回到脉冲前。',
  residualHigh: '余热阈值越限。下一次回环将带着这笔账开始。建议：减少对休眠侧的热推送。',
  denyCold: '撤离许可驳回：休眠乘员仍在站体锚点热耦合内。先把储冷与余热压到规程窗，再申请离站。',
  denyPhase: '撤离许可驳回：当前相位仍属回环采样窗。乘员若在此刻离舱，将被记入下一帧「站体状态」而非「离站状态」。',
  fakeEscape: '逃出的是舱。环还在。',
  trueEnd: '环已偏开。',
};
export const TRUE_END_SOLVED = 2;
export const HINTS = [
  '维护室里有一块备用电池。试着在主电源开启时接通它。',
  '门锁和逃生舱都连接主电源，但它们需要的状态相反。留意电池充满后出现的新操作。',
  '充满不代表独立供电。隔离会把电池从公共电网中分开。能源优先隔离会抽走 1 点储冷。',
  '温控分配器每环只能拨一次。休眠优先更容易攒冷，但充电会把热负荷推向安全线。',
  '主电源开启 → 电池充满并隔离 → 能源室断电 → 穿过安全门 → 在储冷还够的时候启动逃生舱。',
];
export function roomAt(p) { return p.x < -4 ? (p.z < 0 ? ROOMS[1] : ROOMS[0]) : p.x < 4 ? ROOMS[2] : ROOMS[3]; }
export function questionById(id) { return QUESTIONS.find(q => q.id === id) || null; }
export function nextQuestion(solved) {
  return QUESTIONS.find(q => !solved.includes(q.id))?.id || null;
}
