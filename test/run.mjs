/**
 * 离线场景测试：每个场景起一个独立 node 进程，装上指定插件，验证
 * 退出码 + chaos.log 里的关键行。不碰任何真实 DSH profile，也不会伤到正在跑的宿主。
 *
 * 运行：node test/run.mjs
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCENARIO = fileURLToPath(new URL('./scenario.mjs', import.meta.url))
const DELAY_MS = '250'

/** expectStatus：'alive' = 0；数字 = 精确退出码 */
const cases = [
  {
    name: '1 号单飞，装 codex：必须崩',
    plugins: [1], fake: 'codex', expectStatus: 66,
    expectLogs: ['发现同行', '没有修复器兜底', 'exit 66'],
  },
  {
    name: '1 号单飞，没同行：活着',
    plugins: [1], fake: 'none', expectStatus: 'alive',
    expectLogs: ['没发现'],
  },
  {
    name: '1 号 + 2 号：修好了',
    plugins: [1, 2], fake: 'codex', expectStatus: 'alive',
    expectLogs: ['二号插件（修复器）在岗', '不崩'],
  },
  {
    name: '2 号 + 3 号：3 号见到 2 号就崩',
    plugins: [2, 3], fake: 'none', expectStatus: 1,
    expectLogs: ['二号插件在岗', '没有四号插件兜底', 'exit 1'],
  },
  {
    name: '1 + 2 + 3：2 号修好 1 号，也救不了 3 号的崩',
    plugins: [1, 2, 3], fake: 'codex', expectStatus: 1,
    expectLogs: ['二号插件在岗', '没有四号插件兜底'],
  },
  {
    name: '1 + 2 + 3 + 4：全套装齐，互相按住',
    plugins: [1, 2, 3, 4], fake: 'codex', expectStatus: 'alive',
    expectLogs: ['二号插件（修复器）在岗', '四号插件（修复的修复）在岗'],
  },
  {
    name: '2 + 3 + 4：没有 1 号，3 号被 4 号按住',
    plugins: [2, 3, 4], fake: 'none', expectStatus: 'alive',
    expectLogs: ['四号插件（修复的修复）在岗'],
  },
  {
    name: 'log 模式：1 号单飞也只记日志',
    plugins: [1], fake: 'codex', mode: 'log', expectStatus: 'alive',
    expectLogs: ['[log 模式]'],
  },
  {
    name: 'log 模式：全套装齐照常活着',
    plugins: [1, 2, 3, 4], fake: 'codex', mode: 'log', expectStatus: 'alive',
    expectLogs: ['二号插件（修复器）在岗', '四号插件（修复的修复）在岗'],
  },
  {
    name: '逆序装载（4,3,2,1）：四号先拆引信，宿主仍稳',
    plugins: [4, 3, 2, 1], fake: 'codex', expectStatus: 'alive',
    expectLogs: ['二号插件（修复器）在岗'],
  },
]

let failed = 0
const results = []

for (const c of cases) {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-chaos-test-'))
  const env = {
    ...process.env,
    DSH_CHAOS_LOG_DIR: dir,
    DSH_CHAOS_DELAY_MS: DELAY_MS,
    DSH_CHAOS_FAKE_FINDINGS: c.fake,
    DSH_CHAOS_MODE: c.mode === 'log' ? 'log' : 'armed',
  }
  // 用 inherit 而不是管道：本机沙箱会拦住 piped stdio 的 spawn（EPERM），
  // 断言只依赖退出码 + chaos.log，子进程的输出直接透传到控制台。
  const res = spawnSync(process.execPath, [SCENARIO, c.plugins.join(',')], {
    env,
    stdio: 'inherit',
    timeout: 60000,
  })
  const logPath = join(dir, 'chaos.log')
  const text = existsSync(logPath) ? readFileSync(logPath, 'utf8') : ''

  const statusOk = c.expectStatus === 'alive'
    ? res.status === 0
    : res.status === c.expectStatus
  const missing = (c.expectLogs || []).filter((s) => !text.includes(s))
  const logsOk = missing.length === 0
  const ok = statusOk && logsOk

  if (!ok) failed += 1
  results.push({ ok, c, res, missing, text })

  if (dir.startsWith(tmpdir())) {
    try { rmSync(dir, { recursive: true, force: true }) } catch (err) {}
  }
}

for (const r of results) {
  console.log((r.ok ? 'PASS' : 'FAIL') + '  ' + r.c.name)
  if (!r.ok) {
    console.log('      期望状态: ' + r.c.expectStatus + '，实际: ' + r.res.status)
    if (r.missing.length) console.log('      日志缺少: ' + r.missing.join(' / '))
    if (r.res.stdout) console.log('      stdout: ' + r.res.stdout.trim().split(/\r?\n/).slice(-10).join(' | '))
    if (r.res.stderr) console.log('      stderr: ' + r.res.stderr.trim().split(/\r?\n/).slice(0, 6).join(' | '))
  }
}

console.log('\n' + (cases.length - failed) + '/' + cases.length + ' 通过')
process.exit(failed === 0 ? 0 : 1)
