/**
 * dsh-chaos-fixer-crash-fixer —— 四号插件：拆掉三号插件（见二号就崩）的引信。
 *
 * 做法与二号插件同构：上线即在共享总线上点亮 suppress.fixer，
 * 三号插件开火前会检查这个标记，看到就放弃退出。
 *
 * 为什么用「协作式拆引信」而不是给宿主装一个全局 uncaughtException 兜底：
 * 全局兜底会把宿主将来所有未捕获异常一起吞掉，那是比崩溃更坏的事。
 * 本插件只拆自己认识的引信，别的一概不碰。
 *
 * 安全开关：DSH_CHAOS_MODE=log 时三号插件本来就不退出，本插件照常登记。
 */
import { mkdirSync, appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const LOG_DIR = process.env.DSH_CHAOS_LOG_DIR || join(DSH_HOME, 'chaos')
const LOG_FILE = join(LOG_DIR, 'chaos.log')
const TAG = 'fixer-crash-fixer'

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

export const name = 'chaos-fixer-crash-fixer'

export function apply() {
  const b = bus()
  b.fixers.fixerCrashFixer = true
  b.suppress.fixer = true
  log('上线：拆三号插件（见二号就崩）的引信。')
}
