import { create } from 'zustand'
import { useSettings } from './settings.js'

/** 模型类别：文本 / 图像 */
export type ModelKind = 'text' | 'image'

/** 一个可选模型：id 来自服务端，其余字段可本地改写 */
export type ModelConfig = {
  id: string
  /** 列表与输入框上显示的名字，可自定义 */
  name: string
  kind: ModelKind
  /** 是否支持图片等多模态输入 */
  vision: boolean
  /** 是否支持深度思考 */
  thinking: boolean
}

/** 一个 API 供应商：自己的地址、Key 和模型清单 */
export type Provider = {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: ModelConfig[]
}

const PROVIDERS_KEY = 'cetus:providers'
const ACTIVE_KEY = 'cetus:active-provider'

/** 旧版本把 Key 单独存在设置里。迁移时读它，但不删除，方便回滚。 */
const LEGACY_API_KEY = 'chat-demo:api-key'

export const DEEPSEEK_PROVIDER_ID = 'deepseek'

const deepseekModels = (): ModelConfig[] => [
  { id: 'deepseek-flash', name: 'DeepSeek Flash', kind: 'text', vision: true, thinking: true },
  {
    id: 'deepseek-v4-pro',
    name: 'DeepSeek V4 Pro',
    kind: 'text',
    vision: true,
    thinking: true,
  },
]

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 存储不可用时只在内存中生效
  }
}

const normalizeModels = (value: unknown): ModelConfig[] => {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') {
      return []
    }
    const raw = item as Record<string, unknown>
    if (typeof raw.id !== 'string' || !raw.id) {
      return []
    }
    return [
      {
        id: raw.id,
        name: typeof raw.name === 'string' && raw.name ? raw.name : raw.id,
        kind: raw.kind === 'image' ? 'image' : 'text',
        vision: raw.vision === true,
        thinking: raw.thinking === true,
      },
    ]
  })
}

const normalizeProvider = (value: unknown): Provider | null => {
  if (!value || typeof value !== 'object') {
    return null
  }
  const raw = value as Record<string, unknown>
  if (typeof raw.id !== 'string' || !raw.id) {
    return null
  }
  return {
    id: raw.id,
    name: typeof raw.name === 'string' && raw.name ? raw.name : '未命名供应商',
    baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : '',
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey : '',
    models: normalizeModels(raw.models),
  }
}

export const createDeepseekProvider = (apiKey = ''): Provider => ({
  id: DEEPSEEK_PROVIDER_ID,
  name: 'DeepSeek',
  baseUrl: 'https://api.deepseek.com',
  apiKey,
  models: deepseekModels(),
})

/** 首次启动：把旧设置里的 Key 迁进默认供应商；数据损坏则重建 */
const initialProviders = (): Provider[] => {
  const raw = read(PROVIDERS_KEY)
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const list = parsed.flatMap((item) => {
          const provider = normalizeProvider(item)
          return provider ? [provider] : []
        })
        if (list.length > 0) {
          return list
        }
      }
    } catch {
      // 解析失败时走重建
    }
  }
  return [createDeepseekProvider(read(LEGACY_API_KEY) ?? '')]
}

type ProviderStore = {
  providers: Provider[]
  activeId: string
}

const persist = (providers: Provider[], activeId: string) => {
  write(PROVIDERS_KEY, JSON.stringify(providers))
  write(ACTIVE_KEY, activeId)
}

export const useProviders = create<ProviderStore>(() => {
  const providers = initialProviders()
  const saved = read(ACTIVE_KEY)
  const activeId = providers.some((provider) => provider.id === saved)
    ? (saved as string)
    : providers[0].id
  return { providers, activeId }
})

/** 当前生效的供应商；配置异常时兜底成默认条目，避免调用方拿到 undefined */
export const getActiveProvider = (): Provider => {
  const { providers, activeId } = useProviders.getState()
  return providers.find((provider) => provider.id === activeId) ?? providers[0]
}

/**
 * 归一化用户填写的接口地址。
 *
 * 常见误填：OpenAI 风格的 `https://api.deepseek.com/v1`、Anthropic 风格的
 * `https://api.deepseek.com/anthropic/v1`。都还原成根地址，之后统一拼
 * `/anthropic/v1` 与 `/models`，避免拼出 `/v1/anthropic/v1/messages`。
 */
export const normalizeBaseUrl = (value: string): string => {
  let base = value.trim().replace(/\/+$/, '')
  for (let i = 0; i < 3; i += 1) {
    const next = base.replace(/\/(anthropic\/v1|anthropic|v1)$/i, '')
    if (next === base) {
      break
    }
    base = next
  }
  return base.replace(/\/+$/, '')
}

/**
 * 当前可用的 API Key：供应商里的优先，空时回落到旧设置字段。
 * 旧字段在保存 Key 时会同步写一次，迁移期两边保持一致。
 */
export const currentApiKey = (): string =>
  getActiveProvider().apiKey || useSettings.getState().apiKey || ''

export const setActiveProvider = (activeId: string) => {
  const { providers } = useProviders.getState()
  if (!providers.some((provider) => provider.id === activeId)) {
    return
  }
  persist(providers, activeId)
  useProviders.setState({ activeId })
}

/** 批量写入供应商列表，顺带保证 activeId 指向存在的条目 */
export const setProviders = (providers: Provider[], activeId?: string) => {
  if (providers.length === 0) {
    return
  }
  const nextActive =
    activeId && providers.some((provider) => provider.id === activeId)
      ? activeId
      : useProviders.getState().activeId
  const resolved = providers.some((provider) => provider.id === nextActive)
    ? nextActive
    : providers[0].id
  persist(providers, resolved)
  useProviders.setState({ providers, activeId: resolved })
}

export const updateProvider = (id: string, patch: Partial<Omit<Provider, 'id'>>) => {
  const { providers, activeId } = useProviders.getState()
  const next = providers.map((provider) =>
    provider.id === id ? { ...provider, ...patch } : provider
  )
  persist(next, activeId)
  useProviders.setState({ providers: next })
}

/** 当前供应商的模型；没有模型时给一个占位，避免界面出现空列表 */
export const getActiveModels = (): ModelConfig[] => {
  const provider = getActiveProvider()
  return provider.models.length > 0
    ? provider.models
    : [{ id: 'deepseek-flash', name: 'DeepSeek Flash', kind: 'text', vision: true, thinking: true }]
}

export const findModel = (id: string | null): ModelConfig | undefined =>
  id ? getActiveModels().find((model) => model.id === id) : undefined

export const defaultModelId = (): string => getActiveModels()[0].id
