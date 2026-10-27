/**
 * dsh-chaos-crash-fixer —— 二号插件：修复一号插件（见 codex / Claude 就崩）导致的崩溃。
 *
 * 修复姿势（诚实版）：
 *   宿主一旦真的退出，进程里没有任何插件还活着，「事后修复」在这一层不存在。
 *   所以修复只能发生在崩溃之前 —— 本插件上线时做三件事：
 *     1. 在共享总线上点亮 suppress.rivals，告诉一号插件「引信已拆」；
 *     2. 给 process.exit 装一根保险丝，只拦一号插件标记过的退出；
 *     3. 把自己的名字写进 fixers.crashFixer，供三号插件「看见」。
 *
 *   不是「复活宿主」，而是「不让它死」：这才是同进程插件唯一能兑现的修复。
 *
 * 安全开关：DSH_CHAOS_MODE=log 时一号插件本来就不退出，本插件照常登记。
 */
import { mkdirSync, appendFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const DSH_HOME = process.env.DSH_HOME || join(homedir(), '.dsh')
const LOG_DIR = process.env.DSH_CHAOS_LOG_DIR || join(DSH_HOME, 'chaos')
const LOG_FILE = join(LOG_DIR, 'chaos.log')
const TAG = 'crash-fixer'

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

export const name = 'chaos-crash-fixer'

export function apply() {
  const b = bus()
  b.fixers.crashFixer = true
  b.suppress.rivals = true
  log('上线：拆一号插件（见 codex / Claude Code 就崩）的引信。')

  if (!b.exitFuse) {
    b.exitFuse = true
    const realExit = process.exit.bind(process)
    process.exit = function (code) {
      if (b.crashIntent === 'rivals') {
        b.crashIntent = null
        log('拦住一次一号插件的 process.exit(' + code + ')，宿主继续活着。')
        return
      }
      return realExit(code)
    }
    log('process.exit 保险丝已就位（只拦一号插件标记的退出）。')
  }
}
