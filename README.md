# dsh-chaos-plugins · 四条互相咬的鱼

> 玩笑插件合集，一条龙自相矛盾：**检测到 codex / Claude Code 就崩 → 修它 → 见修复器就崩 → 修那个崩**。
> ⚠️ 武装模式下装错一个，宿主真的会退出。别在正在干活的宿主上装。

## 免责声明与警告

- **这是玩笑插件，不是生产力工具。** 四个插件会主动退出 DSH 宿主进程；装错组合会让宿主陷进启动崩溃循环。
- **与 OpenAI、Anthropic、DeepSeek 无关**，不代表任何官方或厂商立场。
- **只在你自己的、愿意承担后果的机器上装。** 不要装到别人的机器上，也不要当恶作剧去分发。
- **收录不等于安全审查。** 插件市场只核对「条目描述是否与代码一致」，不审计安全性；装不装由你决定。
- **出事怎么救**：先给宿主设 `DSH_CHAOS_MODE=log` 并重启（四个插件都只记日志、不退出），或在插件页停用；实在开不了机，就在对应 profile 里移除这四个包。

## 四条鱼一览

| # | 包 | 角色 | 触发条件 | 后果 |
|---|---|---|---|---|
| 1 | `packages/dsh-chaos-rivals-crasher` | 见同行就崩 | 发现 codex / Claude Code | `process.exit(66)` |
| 2 | `packages/dsh-chaos-crash-fixer` | 修 1 号 | 无条件先拆 1 号的引信 | 拦下 1 号的退出 |
| 3 | `packages/dsh-chaos-fixer-crasher` | 见修复器就崩 | 发现 2 号在岗 | `process.exit(1)` |
| 4 | `packages/dsh-chaos-fixer-crash-fixer` | 修 3 号 | 无条件先拆 3 号的引信 | 拦下 3 号的退出 |

**装齐四条 = 谁也崩不了；只装 1 号 = 见到 codex/Claude 就崩；装了 1+2+3 却没 4 = 见到 2 号就崩。**

## 它们怎么互相看见

四个插件在同一个宿主进程里，共享一块寄存器 `globalThis.__DSH_CHAOS__`：

- 1 号上线 → 排一枚 1500ms 后引爆的炸弹（先探测 codex / Claude Code）
- 2 号上线 → 点亮 `suppress.rivals`，并给 `process.exit` 装保险丝（只拦 1 号打过标记的退出）
- 3 号上线 → 看见 2 号就排自己的炸弹
- 4 号上线 → 点亮 `suppress.fixer`
- 炸弹引爆前都先问一句「引信被拆了吗」，拆了就不崩

## 为什么崩溃要等 1.5 秒

宿主退出以后，进程里没有任何插件还活着，**修复只可能发生在崩溃之前**。所以 1 号和 3 号都把处决延迟（`DSH_CHAOS_DELAY_MS`，默认 1500ms），给修复插件留出上线拆引信的时间。这不是偷懒，是同进程插件唯一能兑现的「修复」：不是起死回生，而是不让它死。

## 检测口径

1 号认为「电脑上有 codex / Claude Code」的条件（任一命中即可）：

- PATH 里的 `codex` / `claude` 启动器（`.exe` / `.cmd` / `.bat` / `.ps1`）
- npm 全局目录里的同名启动器
- `~/.codex`、`~/.claude`、`~/.claude.json`、`~/.config/claude`
- 正在运行、进程名里含 codex / claude 的进程

本机实测：`codex` 在 PATH 里，`~/.codex` 和 `~/.claude` 也都在 → 1 号会真的开火。

## 安装

先装修复件（2 号、4 号），再装挑事的两条（1 号、3 号）。这样 bundle 顺序里 2 号排在 3 号前面，3 号才能在 `apply()` 里看见 2 号。

```powershell
dsh plugin --profile web add "github:V01d-Project/dsh-chaos-plugins#path:/packages/dsh-chaos-crash-fixer"
dsh plugin --profile web add "github:V01d-Project/dsh-chaos-plugins#path:/packages/dsh-chaos-fixer-crash-fixer"
dsh plugin --profile web add "github:V01d-Project/dsh-chaos-plugins#path:/packages/dsh-chaos-rivals-crasher"
dsh plugin --profile web add "github:V01d-Project/dsh-chaos-plugins#path:/packages/dsh-chaos-fixer-crasher"
```

然后重启 `dsh web`。

桌面端的 `desktop` profile 由 Electron 独占，`dsh plugin --profile desktop` 会被直接拒绝；请用桌面里的插件管理页面（或宿主内置的 `plugin_manager`）装同样四条 `github:` 路径，装完完全退出客户端再打开。

## 安全阀

- `DSH_CHAOS_MODE=log`：四个插件照常上线、照常写日志，但一个都不退出宿主。救急、调试用。
- `DSH_CHAOS_DELAY_MS=3000`：把引信拉长，方便看清顺序。
- 日志：`%USERPROFILE%\.dsh\chaos\chaos.log`（或 `$DSH_HOME\chaos\chaos.log`）。
- 测试钩子（仅供离线测试）：`DSH_CHAOS_FAKE_FINDINGS=codex|claude|none` 覆盖真实检测。

## 离线测试

```powershell
cd .\test
node run.mjs
```

10 个场景，全部在独立 node 进程里起，不碰任何真实 profile：1 号单飞崩（exit 66）、1+2 稳、2+3 崩（exit 1）、1+2+3 崩、全套装齐稳、逆序装载稳、log 模式全稳。

## 卸载 / 停用

- 立刻止血：先别重启宿主，给宿主设 `DSH_CHAOS_MODE=log`，再处理。
- 从对应 profile 里移除四个包，重启宿主。
- 只装了 1 号的话，宿主会变成启动崩溃循环 —— 先塞 2 号，或者先上 log 模式。

## 已知边界

- 修复是「提前拆引信」，不是「起死回生」；宿主退出后不会自己回来。
- 没有看门狗 / 自动重启；崩溃码：1 号 `exit 66`，3 号 `exit 1`。
- 检测是启发式：藏在容器、远程机器、改过名的二进制都不算。
- 四个插件靠 `globalThis` 约定协作，不是沙箱隔离 —— 任何第三方插件都能伪造总线标记。
