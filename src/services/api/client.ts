import { translate, type TranslationMessage } from '../../i18n/index.js'
import { readMessageEvent } from './parseEvent.js'
import { readServerSentEvents } from './sse.js'
import type {
  ApiErrorBody,
  CreateMessageRequest,
  FileObject,
  FilePurpose,
  MessageStreamEvent,
} from './types.js'

import { getActiveProvider, normalizeBaseUrl } from '../providers.js'

/**
 * 当前供应商的 API 根地址，**原样保留**用户填写的路径（去掉末尾斜杠）。
 *
 * 这里刻意不做 /v1 剥离：很多中转的 base 就是 `.../v1`，剥掉会拿到 404 或直接
 * 被网关断开，表现为"网络异常"。只有 Anthropic 端点需要特殊拼接，见 anthropicBaseUrl。
 */
export const apiOrigin = (): string =>
  getActiveProvider().baseUrl.trim().replace(/\/+$/, '') || 'https://api.deepseek.com'

/**
 * Anthropic 兼容接口前缀。
 * - base 已经是 `.../anthropic/v1` → 直接用
 * - base 是 `.../anthropic` → 补 `/v1`
 * - 其余（含 DeepSeek 的根地址）→ 追加 `/anthropic/v1`
 */
const anthropicBaseUrl = (): string => {
  const base = apiOrigin()
  if (/\/anthropic\/v1$/i.test(base)) {
    return base
  }
  if (/\/anthropic$/i.test(base)) {
    return `${base}/v1`
  }
  return `${base}/anthropic/v1`
}
/** 引用 Files API 上传的图片、调用 Anthropic 兼容 Files API 时必须携带 */
const FILES_BETA = 'files-api-2025-04-14'

export type ApiErrorKind =
  /** 非 2xx 响应 */
  | 'http'
  /** 流中返回的错误帧（如等待生成超时），随后连接关闭 */
  | 'stream'
  /** 请求没有到达服务端（断网、跨域被拦截等） */
  | 'network'
  /** 流在 message_stop 之前结束 */
  | 'interrupted'
  /** 响应不符合协议（如非 SSE 响应） */
  | 'protocol'

export class ApiError extends Error {
  readonly localMessage?: TranslationMessage

  constructor(
    readonly kind: ApiErrorKind,
    message: string | TranslationMessage,
    readonly status?: number
  ) {
    super(typeof message === 'string' ? message : translate(message.key, message.params))
    this.name = 'ApiError'
    this.localMessage = typeof message === 'string' ? undefined : message
  }
}

const isErrorBody = (value: unknown): value is ApiErrorBody =>
  typeof value === 'object' &&
  value !== null &&
  'error' in value &&
  typeof (value as ApiErrorBody).error?.message === 'string'

const readErrorResponse = async (
  response: Response,
  kind: 'http' | 'protocol' = 'http',
  fallback = response.statusText
): Promise<ApiError> => {
  const text = await response.text().catch(() => '')
  let message = text || fallback
  try {
    const body: unknown = JSON.parse(text)
    if (isErrorBody(body)) {
      message = body.error.message
    }
  } catch {
    // 非 JSON 响应体直接展示原文
  }
  return new ApiError(kind, message, response.status)
}

export const request = async (url: string, init: RequestInit): Promise<Response> => {
  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    if (init.signal?.aborted) {
      throw error
    }
    throw new ApiError('network', error instanceof Error ? error.message : String(error))
  }
  if (!response.ok) {
    throw await readErrorResponse(response)
  }
  return response
}

const anthropicHeaders = (apiKey: string, beta: boolean): Record<string, string> => ({
  // DeepSeek 兼容接口的鉴权方式，也可使用 Authorization: Bearer。
  'x-api-key': apiKey,
  // Files API 和通过 file_id 引用图片时必传；纯文本聊天无需携带。
  ...(beta ? { 'anthropic-beta': FILES_BETA } : {}),
})

/** 用 GET /models 校验 API Key（不产生费用） */
export const verifyApiKey = async (apiKey: string, signal?: AbortSignal): Promise<void> => {
  await request(`${apiOrigin()}/models`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}` },
    signal,
  })
}

/**
 * 拉取供应商的模型列表。
 *
 * 各家的 `/models` 位置不一样：DeepSeek 在 `{root}/models`，OpenAI 风格在
 * `{base}/v1/models`。这里按候选顺序依次尝试，第一个有结果的用；
 * 401/403 直接抛出，不把鉴权失败当地址问题反复试。
 */
export const fetchModels = async (
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<string[]> => {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  const root = normalizeBaseUrl(baseUrl) || 'https://api.deepseek.com'
  const candidates = [`${trimmed}/models`, `${root}/v1/models`, `${root}/models`].filter(
    (url, index, list) => list.indexOf(url) === index
  )

  let lastError: unknown
  for (const url of candidates) {
    try {
      const response = await request(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
      })
      const body = (await response.json()) as { data?: Array<{ id?: unknown }> }
      const ids = (body.data ?? []).flatMap((item) =>
        typeof item.id === 'string' && item.id ? [item.id] : []
      )
      if (ids.length > 0) {
        return ids
      }
    } catch (error) {
      lastError = error
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        throw error
      }
    }
  }
  if (lastError) {
    throw lastError
  }
  return []
}

/**
 * POST /anthropic/v1/files 上传附件（不设过期时间，会话里的历史附件一直可用）。
 * purpose 为 null 时不传该字段（图片）；purpose 必须排在 file 之前。
 */
export const uploadFile = async (
  apiKey: string,
  file: File,
  purpose: FilePurpose | null,
  signal?: AbortSignal
): Promise<FileObject> => {
  const form = new FormData()
  if (purpose) {
    form.append('purpose', purpose)
  }
  form.append('file', file)
  const response = await request(`${anthropicBaseUrl()}/files`, {
    method: 'POST',
    headers: anthropicHeaders(apiKey, true),
    body: form,
    signal,
  })
  return (await response.json()) as FileObject
}

/** DELETE /anthropic/v1/files/{file_id} */
export const deleteFile = async (apiKey: string, fileId: string): Promise<void> => {
  await request(`${anthropicBaseUrl()}/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: anthropicHeaders(apiKey, true),
  })
}

const hasFile = (body: CreateMessageRequest) =>
  body.messages.some(
    (message) =>
      typeof message.content !== 'string' &&
      message.content.some((block) => block.type === 'image' || block.type === 'document')
  )

/**
 * POST /anthropic/v1/messages（stream: true），逐个产出流式事件，收到 message_stop 时结束。
 * ping、保活注释与无法解析的内容不产出；中止请求时抛出 signal 的 AbortError。
 */
export async function* streamMessage(
  apiKey: string,
  body: CreateMessageRequest,
  signal: AbortSignal
): AsyncGenerator<MessageStreamEvent> {
  const response = await request(`${anthropicBaseUrl()}/messages`, {
    method: 'POST',
    headers: {
      ...anthropicHeaders(apiKey, hasFile(body)),
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  })
  const contentType = response.headers.get('Content-Type') ?? ''
  if (!response.body || !contentType.includes('text/event-stream')) {
    throw await readErrorResponse(response, 'protocol', '')
  }
  for await (const { event: eventName, data } of readServerSentEvents(response.body, signal)) {
    let payload: unknown
    try {
      payload = JSON.parse(data)
    } catch {
      if (eventName !== 'error') {
        continue
      }
    }
    if (isErrorBody(payload)) {
      throw new ApiError('stream', payload.error.message)
    }
    if (eventName === 'error') {
      throw new ApiError('stream', data)
    }
    const event = readMessageEvent(payload)
    if (!event) {
      continue
    }
    yield event
    if (event.type === 'message_stop') {
      return
    }
  }
  // 服务端没有提供错误内容时保持为空，不推测断流原因。
  throw new ApiError('interrupted', '')
}
