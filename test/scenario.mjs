/**
 * 测试场景：在独立 node 进程里按顺序装上指定插件，看宿主活不活。
 * 用法：node scenario.mjs "1,2,3,4"
 *
 * 插件只用到 apply()（不碰 ctx），所以这里给一个空壳 ctx 就够。
 * 真正安装时由 DSH 的 cordis 装载器调用 apply()，语义相同。
 */
const map = {
  1: '../packages/dsh-chaos-rivals-crasher/lib/index.js',
  2: '../packages/dsh-chaos-crash-fixer/lib/index.js',
  3: '../packages/dsh-chaos-fixer-crasher/lib/index.js',
  4: '../packages/dsh-chaos-fixer-crash-fixer/lib/index.js',
}

const spec = String(process.argv[2] || '1')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const ctx = {}

for (const n of spec) {
  const file = map[n]
  if (!file) {
    console.error('未知插件编号: ' + n)
    process.exit(97)
  }
  const mod = await import(new URL(file, import.meta.url))
  const apply = typeof mod.apply === 'function'
    ? mod.apply
    : (mod.default && typeof mod.default.apply === 'function' ? mod.default.apply : null)
  if (!apply) {
    console.error('插件 ' + n + ' 没有导出 apply()')
    process.exit(97)
  }
  await apply(ctx)
  console.log('[scenario] 已装载插件 ' + n)
}

// 等到所有定时炸弹都开完火。能走到这里说明宿主还活着。
const wait = Number(process.env.DSH_CHAOS_DELAY_MS || 1500) + 500
await new Promise((resolve) => setTimeout(resolve, wait))
console.log('SURVIVED')
process.exit(0)
