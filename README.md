# 恒星升起前 · Before the Star

Panda Game Jam 科幻循环解谜。主题是 **「环 / Cycle」**。

## 马上玩 · Play this build

要玩的是 **静默环**：42 秒一到立刻回溯，短跳帧后回到出生点，没有失败窗。假逃离落地后只出现一句「逃出的是舱。环还在。」标题眉题是 **静默环 / 无结算**。

```sh
python3 -m http.server 8765 -d playable
```

打开 `http://127.0.0.1:8765/`。`docs/` 是同一份新构建，给 GitHub Pages。`reference/v2-dist/` 才是原来的 V2，不要再把服务器指到那里。不要用 `file://`。

源码：

```sh
npm i && npm run dev
npm test
npm run build
```

The new static game is `playable/`. `reference/v2-dist/` is the old V2 comparison and will feel unchanged.

A short sci-fi loop puzzle for the Panda Game Jam. The theme is **Cycle**.

## 中心命题 · Center

往后的中心，是一次 **生命保障交接**：把休眠乘员赖以生存的循环，从曙光站交到逃生舱上，让逃生舱在脱离母站之后仍能独立撑过预定航程。玩家不是逃出一个环，而是在旧的生命之环断掉之前，亲手接出一个新的。

故事方向见 [docs/last-handoff-story-brief.md](docs/last-handoff-story-brief.md)（《最后一次交接》）。本仓库这一版 **不实现** 空气系统，也不做整段交接改写。

**现在能玩的切片** 是 V2 温控环，叠加上锁定的 **方案丙**（每环一次温控取舍 + 热账咬合）和好玩补丁 **① 假设环**、**② 可见热痕 / 霜痕**。

**下一刀原型** 只比较能源侧和温控侧的策略。空气先留在叙事和状态灯里，不做成第三条资源条。

The future center is a life-support handoff: move the sleepers' loop from the station onto the escape pod so the pod can keep them alive after it leaves. This build does **not** implement air, and it does not rewrite the game into that full handoff.

The playable slice is the V2 thermal loop, plus locked scheme C (one thermal choice per loop, and the heat/cold bite) and fun patches ① (one open hypothesis per loop) and ② (visible heat and frost scars).

The next prototype cut compares energy versus thermal strategies only. Air stays narrative, a status light at most, not a third resource bar.

## 当前基线 · What plays now

规则从 [reference/v2-dist/](reference/v2-dist/) 的可玩 V2 构建反查回来，再按设计文档打补丁。V2 源码原先不在这个仓库里，只有 dist。现在根目录的 Vite 工程已经补到 V2，并叠上丙和 ①②。

Recovered from the playable V2 build in [reference/v2-dist/](reference/v2-dist/), then patched. V2 previously shipped as dist only. This source is that loop, brought up to V2 and then patched.

| 项 | V2 | 这一版 |
| --- | --- | --- |
| 环 / 充电 / 发射 | 42s / 4s / 2s | 不动 |
| 温控切换 | 无限 | **每环 1 次**。默认能源优先，不预扣 |
| `chargeCold` | 2 | **1** |
| `coldSeconds` | 6 | **5** |
| `recoveryPerSecond` | 0.2 | **0.15** |
| 隔离 | 无副产物 | 能源优先 **储冷 −1**；休眠优先 **+0.5s** |
| 余热 | `max(2, min(4, r−1))` | 保留。**没有**手动卸热 |
| 精通 | 无 | 发现 ≥3、通关 ≥1，或解开 ≥2 条假设后，可选 **电池 50% 且未隔离** |
| Tab | 认知清单 | **一条本环假设** + 已解事实 + **0–42s 简轴** |
| 世界表皮 | 无 | 过热留下 **热痕**；冷拒发留下 **霜痕**。余热开局播戏核那一句 |

胜利仍然是：主网断开，电池充满且隔离，发射 2 秒内储冷始终 ≥ 1，并且赶在 42 秒内完成。认知不锁门。

能源优先大约 15–20 秒，断闸之后要直接去逃生舱，磨蹭过 5 秒储冷会掉破保障线。休眠优先多 1 点储冷，但充电把热负荷推到安全线，而且这一环不能再拨回去。

## 怎么跑 · Run

Node 20.19+ 或 22.12+。

```sh
npm i
npm run dev
npm test
npm run build
```

`npm run dev` 启动 Vite。`npm run build` 输出到 `dist/`（不入库）。几何、恒星和声音都在本地生成，运行时不请求外网素材。

操作：WASD 移动，E 交互，Tab 打开本环假设。冲击和假逃离是站内折返，不是菜单里的重新开始。按住 R 只是提前把这一圈交还给环，不解假设。半就绪出现时，1 是标准开局，2 是 50% 电量。靠近断路器、即将隔离的电池、发射终端和温控时，E 旁边有一句代价，不占时间。

存档键：`localStorage` / `dawn-station-memory-v1`。继续游戏会新开一环，保留认知、假设、余热和热痕，不恢复半成品电闸。

## 文档 · Docs

- [docs/last-handoff-story-brief.md](docs/last-handoff-story-brief.md) — 《最后一次交接》
- [docs/v2-baseline-for-agents.md](docs/v2-baseline-for-agents.md) — V2 已有什么，丙还缺什么
- [docs/dev-pack-scheme-C-on-V2.md](docs/dev-pack-scheme-C-on-V2.md) — 方案丙裁定
- [docs/scheme-C-final-ohmygame.md](docs/scheme-C-final-ohmygame.md) — 实现工单
- [docs/fun-patch-hypothesis-scar.md](docs/fun-patch-hypothesis-scar.md) — ① 假设环 + ② 可见偏一度
- [docs/rhythm-table-v2-delta.md](docs/rhythm-table-v2-delta.md) — 节奏表
- [docs/恒星升起前-扩玩同构文案-戏核.md](docs/恒星升起前-扩玩同构文案-戏核.md) — 广播与驳回文案
- [reference/v2-dist/](reference/v2-dist/) — 对照用的 V2 构建

`QA.md` 和 `canvas/documents/main-design.md` 是更早的 40 秒基线记录，数值以本 README 和 `docs/` 为准。

## 源码地图 · Layout

```text
src/config.js     房间、设备、42 秒规则、温控常数、假设和戏核文案
src/thermal.js    余热结转、充电热账、失电掉冷、撤离判定
src/state.js      环、交互、方案丙、假设、热痕
src/render.js     Three.js 站体、温控装置、热痕 / 霜痕
src/ui.js         HUD、代价预告、假设板、0–42s 轴、半就绪
src/movement.js   碰撞与视线
src/storage.js    本地存档
src/audio.js      Web Audio
```

## 还没做 · Still open

留给后续 OhMyGame 打磨，而不是这一版的范围：

- 空气循环，以及母站 → 逃生舱的完整生命保障交接
- 热痕 / 霜痕和温控装置的正式美术，而不是现在这套可读的程序外观
- `canvas/` 里的旧设计稿还没有改写成 42 秒 + 方案丙
- 能源线在断闸后的 5 秒窗口很紧，若展出手感偏苛，要在不改锁定数值的前提下再看走线和提示
