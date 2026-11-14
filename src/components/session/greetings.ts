import type { Locale } from '../../services/settings.js'

/**
 * 首页问候语。
 *
 * 每次页面加载随机挑一条（seed 在模块求值时固定），所以「每次打开都不一样」，
 * 但同一次会话里来回切换不会乱跳。填了昵称就带昵称称呼。
 */
const templates: Record<Locale, { named: string[]; anonymous: string[] }> = {
  'zh-CN': {
    named: [
      '{name}，今天想聊点什么？',
      '又见面了，{name}',
      '{name}，有什么想弄明白的？',
      '嗨 {name}，从哪儿开始？',
      '{name}，说来听听',
      '在呢，{name}，你说',
      '{name}，今天想搞明白什么？',
    ],
    anonymous: [
      '今天有什么可以帮到你？',
      '想聊点什么？',
      '说来听听',
      '随时开始，我在',
      '今天想弄明白点什么？',
    ],
  },
  'en-US': {
    named: [
      'What are we getting into today, {name}?',
      "Hey {name}, what's on your mind?",
      'Where do we start, {name}?',
      'Back again, {name}.',
      'Go ahead, {name}',
    ],
    anonymous: [
      'How can I help you today?',
      "What's on your mind?",
      'Where should we start?',
      'Ready when you are',
    ],
  },
}

/** 页面加载时固定一次，刷新才换 */
const seed = Math.random()

export const getGreeting = (locale: Locale, name?: string | null): string => {
  const trimmed = name?.trim()
  const set = templates[locale] ?? templates['zh-CN']
  const list = trimmed ? set.named : set.anonymous
  const template = list[Math.floor(seed * list.length) % list.length]
  return trimmed ? template.replace('{name}', trimmed) : template
}
