/**
 * dsh-chaos-fixer-crasher —— 三号插件：发现二号插件（修复器）在岗，就让宿主退出。
 *
 * 为什么能崩过二号插件的保险丝：二号只拦「crashIntent === 'rivals'」的退出，
 * 我们标记的是 'fixer'，它不认。这正是笑话的核心 —— 修好了一号的崩溃，
 * 却为下一场崩溃留了门。
 *
 * 处决用 process.exit(1) 而不是抛未捕获异常：宿主无论如何都会死，不依赖它
 * 有没有装 uncaughtException 处理器。
 *
 * 安全开关：DSH_CHAOS_MODE=log 时只写日志，不退出宿主。
 */
import { mkdirSync, appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const LOG_DIR = process.env.DSH_CHAOS_LOG_DIR || join(DSH_HOME, 'chaos')
const LOG_FILE = join(LOG_DIR, 'chaos.log')
const TAG = 'fixer-crasher'

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

export const name = 'chaos-fixer-crasher'

export function apply() {
  const b = bus()
  b.crashers.fixerCrasher = true
  log('上线：盯着二号插件（修复器）。')

  if (!b.fixers.crashFixer) {
    log('二号插件不在，没得崩，先待着。')
    return
  }

  const delay = Number(process.env.DSH_CHAOS_DELAY_MS || 1500)
  log(`二号插件在岗 —— ${delay}ms 后按设定崩溃。`)
  b.pending.fixerCrash = setTimeout(fire, delay)

  function fire() {
    b.pending.fixerCrash = null
    if (b.suppress.fixer) {
      log('四号插件（修复的修复）在岗，引信已被拆 —— 不崩。')
      return
    }
    if (b.mode === 'log') {
      log('[log 模式] 本来要 process.exit(1) 崩掉宿主，改记一笔。')
      return
    }
    b.crashIntent = 'fixer'
    log('没有四号插件兜底，按设定立刻崩溃（exit 1）。')
    process.exit(1)
  }
}
