import { ApiError, openaiChatUrl, request } from './client.js'
import { readServerSentEvents } from './sse.js'
import type { CreateMessageRequest, MessageStreamEvent, MessageUsage, StopReason } from './types.js'

/** 从内容块里取纯文本；文件、图片等拿不到的用占位符表示 */
const blockText = (block: unknown): string => {
  if (!block || typeof block !== 'object') {
    return ''
  }
  const raw = block as Record<string, unknown>
  if (typeof raw.text === 'string') {
    return raw.text
  }
  if (raw.type === 'image') {
    return '［图片］'
  }
  if (raw.type === 'document') {
    return '［文件］'
  }
  return ''
}

type OpenAIMessage = { role: 'system' | 'user' | 'assistant'; content: string }

/** Anthropic 风格的请求体 → OpenAI Chat Completions 的 messages */
const toOpenAIMessages = (body: CreateMessageRequest): OpenAIMessage[] => {
  const messages: OpenAIMessage[] = []
  const systemParts: string[] = [body.system]
  for (const message of body.messages) {
    // latest_reminder 是 DeepSeek 扩展角色，OpenAI 协议里并入 system
    if (message.role === 'latest_reminder') {
      systemParts.push(message.content)
      continue
    }
    messages.push({
      role: message.role,
      content:
        typeof message.content === 'string'
          ? message.content
          : message.content.map(blockText).join(''),
    })
  }
  const system = systemParts.filter((part) => part.trim()).join('\n\n')
  return system ? [{ role: 'system', content: system }, ...messages] : messages
}

const mapStopReason = (reason: unknown): StopReason => {
  if (reason === 'length') {
    return 'max_tokens'
  }
  if (reason === 'content_filter') {
    return 'refusal'
  }
  return 'end_turn'
}

type Chunk = {
  model?: string
  choices?: Array<{
    delta?: { content?: string; reasoning_content?: string }
    finish_reason?: string | null
  }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

/**
 * 用 OpenAI Chat Completions 协议发一次流式请求，
 * 并把结果翻译成内部统一的 Anthropic 风格事件流 —— 上层（流合并、持久化、渲染）不用感知协议差异。
 */
export async function* streamOpenAIMessage(
  apiKey: string,
  body: CreateMessageRequest,
  signal: AbortSignal
): AsyncGenerator<MessageStreamEvent> {
  const response = await request(openaiChatUrl(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: body.model,
      messages: toOpenAIMessages(body),
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal,
  })

  const contentType = response.headers.get('Content-Type') ?? ''
  if (!response.body || !contentType.includes('text/event-stream')) {
    throw new ApiError('protocol', `Unexpected content type: ${contentType || 'unknown'}`)
  }

  let started = false
  let index = 0
  let thinkingOpen = false
  let textOpen = false
  let stopReason: StopReason = 'end_turn'
  let usage: MessageUsage | undefined

  for await (const { data } of readServerSentEvents(response.body, signal)) {
    if (data === '[DONE]') {
      break
    }

    let chunk: Chunk
    try {
      chunk = JSON.parse(data) as Chunk
    } catch {
      continue
    }

    if (!started) {
      started = true
      yield {
        type: 'message_start',
        message: { id: crypto.randomUUID(), model: chunk.model ?? body.model },
      }
    }

    const choice = chunk.choices?.[0]
    const delta = choice?.delta

    if (delta?.reasoning_content) {
      if (!thinkingOpen) {
        yield {
          type: 'content_block_start',
          index,
          content_block: { type: 'thinking', thinking: '', signature: '' },
        }
        thinkingOpen = true
      }
      yield {
        type: 'content_block_delta',
        index,
        delta: { type: 'thinking_delta', thinking: delta.reasoning_content },
      }
    }

    if (delta?.content) {
      // 思考结束后才开始正文，切换内容块索引
      if (thinkingOpen && !textOpen) {
        yield { type: 'content_block_stop', index }
        index += 1
      }
      if (!textOpen) {
        yield {
          type: 'content_block_start',
          index,
          content_block: { type: 'text', text: '', citations: [] },
        }
        textOpen = true
      }
      yield {
        type: 'content_block_delta',
        index,
        delta: { type: 'text_delta', text: delta.content },
      }
    }

    if (choice?.finish_reason) {
      stopReason = mapStopReason(choice.finish_reason)
    }

    if (chunk.usage) {
      usage = {
        input_tokens: chunk.usage.prompt_tokens ?? 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: chunk.usage.completion_tokens ?? 0,
      }
    }
  }

  // 一个块都没有（空回复）时也要给出结构，避免上层等不到 message_stop
  if (!started) {
    yield { type: 'message_start', message: { id: crypto.randomUUID(), model: body.model } }
    yield {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'text', text: '', citations: [] },
    }
    index = 0
    textOpen = true
  }

  if (thinkingOpen || textOpen) {
    yield { type: 'content_block_stop', index }
  }
  yield { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage }
  yield { type: 'message_stop' }
}
