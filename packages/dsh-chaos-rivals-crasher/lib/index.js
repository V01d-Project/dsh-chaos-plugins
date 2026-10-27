/**
 * dsh-chaos-rivals-crasher —— 一号插件：电脑上有 codex / Claude Code，宿主就崩。
 *
 * 为什么崩溃要延迟一会儿：四个插件装在同一个宿主进程里赛跑。如果一号插件在
 * apply() 里同步 exit，宿主会在装载二号插件之前就没掉 —— 「修复」在物理上不可能。
 * 真正能「修复」的时点只能是崩溃发生之前，所以这里把检测/处决排到启动完成之后
 * （DSH_CHAOS_DELAY_MS，默认 1500ms），给修复插件一个上线拆引信的机会。
 *
 * 检测口径（任意一条命中即算「有」）：
 *   - PATH 里的 codex / claude 启动器（.exe/.cmd/.bat/.ps1）
 *   - npm 全局目录（%APPDATA%\npm 等）里的同名启动器
 *   - 配置目录 ~/.codex、~/.claude、~/.claude.json、~/.config/claude
 *   - 正在运行、进程名里含 codex / claude 的进程
 *
 * 安全开关：DSH_CHAOS_MODE=log 时只写日志，不退出宿主。
 * 测试钩子：DSH_CHAOS_FAKE_FINDINGS=codex 或 none 覆盖真实检测。
 */
import { existsSync, mkdirSync, appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const LOG_DIR = process.env.DSH_CHAOS_LOG_DIR || join(DSH_HOME, 'chaos')
const LOG_FILE = join(LOG_DIR, 'chaos.log')
const TAG = 'rivals-crasher'

function bus() {
  let b = globalThis.__DSH_CHAOS__
  if (!b) {
    b = globalThis.__DSH_CHAOS__ = {
      version: 1,
      mode: String(process.env.DSH_CHAOS_MODE || '').toLowerCase() === 'log' ? 'log' : 'armed',
      crashers: {},
      fixers: {},
      suppress: { rivals: false, fixer: false },
      pending: {},
      crashIntent: null,
      exitFuse: false,
    }
  }
  return b
}

function log(message) {
  const line = `[${new Date().toISOString()}] [${TAG}] ${message}`
  try {
    console.log('[chaos] ' + message)
  } catch (err) {}
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    appendFileSync(LOG_FILE, line + '\n')
  } catch (err) {}
}

function launcherNames() {
  return process.platform === 'win32'
    ? ['codex.exe', 'codex.cmd', 'codex.bat', 'codex.ps1', 'claude.exe', 'claude.cmd', 'claude.bat', 'claude.ps1']
    : ['codex', 'claude']
}

function scanDirs() {
  const dirs = []
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || ''
    const localAppData = process.env.LOCALAPPDATA || ''
    if (appData) dirs.push(join(appData, 'npm'))
    if (localAppData) dirs.push(join(localAppData, 'npm'))
    dirs.push(join(homedir(), 'AppData', 'Roaming', 'npm'))
  } else {
    dirs.push('/usr/local/bin', '/opt/homebrew/bin', join(homedir(), '.local', 'bin'))
  }
  return dirs
}

/** 返回命中的证据列表；空数组表示没发现。 */
function findRivals() {
  const fake = process.env.DSH_CHAOS_FAKE_FINDINGS
  if (fake !== undefined) {
    if (String(fake).trim() === '' || String(fake).trim() === 'none') return []
    return String(fake).split(',').map((s) => 'fake:' + s.trim()).filter((s) => s !== 'fake:')
  }

  const hits = []
  const names = launcherNames()
  const pathDirs = String(process.env.PATH || '')
    .split(process.platform === 'win32' ? ';' : ':')
    .map((s) => s.trim().replace(/^"|"$/g, ''))
    .filter(Boolean)

  for (const dir of [...pathDirs, ...scanDirs()]) {
    for (const name of names) {
      const file = join(dir, name)
      if (existsSync(file)) hits.push(file + ' (launcher)')
    }
  }

  const configDirs = [
    join(homedir(), '.codex'),
    join(homedir(), '.claude'),
    join(homedir(), '.claude.json'),
    join(homedir(), '.config', 'claude'),
  ]
  for (const file of configDirs) {
    if (existsSync(file)) hits.push(file + ' (config)')
  }

  try {
    if (process.platform === 'win32') {
      const out = execFileSync('tasklist', ['/FO', 'CSV', '/NH'], {
        encoding: 'utf8',
        timeout: 4000,
        windowsHide: true,
      })
      for (const line of out.split(/\r?\n/)) {
        const m = /^"([^"]+)"/.exec(line)
        if (m && /codex|claude/i.test(m[1])) hits.push('process:' + m[1])
      }
    } else {
      const out = execFileSync('ps', ['-A', '-o', 'comm='], { encoding: 'utf8', timeout: 4000 })
      for (const line of out.split(/\r?\n/)) {
        const name = line.trim()
        if (name && /codex|claude/i.test(name)) hits.push('process:' + name)
      }
    }
  } catch (err) {
    // 进程扫描失败不算「有」—— 装没装由 PATH / 配置目录决定。
  }

  return [...new Set(hits)]
}

export const name = 'chaos-rivals-crasher'

export function apply() {
  const b = bus()
  b.crashers.rivals = true
  const delay = Number(process.env.DSH_CHAOS_DELAY_MS || 1500)
  log(`上线：${delay}ms 后检查 codex / Claude Code。`)

  b.pending.rivals = setTimeout(check, delay)

  function check() {
    b.pending.rivals = null
    const hits = findRivals()
    if (!hits.length) {
      log('没发现 codex / Claude Code，本鱼这次不砸场子。')
      return
    }
    const shown = hits.slice(0, 5).join(' | ')
    log(`发现同行 ${hits.length} 处：${shown}${hits.length > 5 ? ' …' : ''}`)

    if (b.suppress.rivals) {
      log('二号插件（修复器）在岗，引信已被拆 —— 不崩。')
      return
    }
    if (b.mode === 'log') {
      log('[log 模式] 本来要 process.exit(66)，改记一笔。')
      return
    }
    b.crashIntent = 'rivals'
    log('没有修复器兜底，按设定立刻崩溃（exit 66）。')
    process.exit(66)
  }
}
