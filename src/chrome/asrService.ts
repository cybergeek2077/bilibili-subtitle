import { base64ToBytes } from '../utils/audioUtil'
import { getServerUrl } from './openaiService'

const REQUEST_TIMEOUT = 120 * 1000

const parseExtraBody = (extraBody?: string): Record<string, any> => {
  if (!extraBody?.trim()) return {}
  try {
    return JSON.parse(extraBody)
  } catch (e) {
    throw new Error('额外参数不是合法的 JSON')
  }
}

const readError = async (resp: Response) => {
  const text = await resp.text()
  try {
    const json = JSON.parse(text)
    const msg = json.error?.message ?? json.message ?? json.msg ?? text
    return `${resp.status} ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`
  } catch (e) {
    return `${resp.status} ${text.slice(0, 200)}`
  }
}

const post = async (url: string, apiKey: string | undefined, body: BodyInit, json: boolean) => {
  const headers: Record<string, string> = {}
  if (apiKey) headers.Authorization = 'Bearer ' + apiKey
  if (json) headers['Content-Type'] = 'application/json'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT)
  let resp: Response
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    })
  } catch (e: any) {
    throw new Error(e?.name === 'AbortError' ? '请求超时' : `请求失败: ${e?.message as string ?? String(e)}`)
  } finally {
    clearTimeout(timer)
  }
  if (!resp.ok) {
    throw new Error(await readError(resp))
  }
  return await resp.json()
}

/**
 * OpenAI 兼容的 /audio/transcriptions
 */
const transcribeByTranscriptions = async (config: AsrConfig, wav: Uint8Array, prompt?: string): Promise<AsrResult> => {
  const form = new FormData()
  form.append('file', new Blob([wav], { type: 'audio/wav' }), 'audio.wav')
  form.append('model', config.model)
  if (config.language) form.append('language', config.language)
  if (prompt) form.append('prompt', prompt)
  if (config.timestamps) {
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'segment')
  } else {
    form.append('response_format', 'json')
  }
  for (const [key, value] of Object.entries(parseExtraBody(config.extraBody))) {
    form.append(key, typeof value === 'string' ? value : JSON.stringify(value))
  }

  const resp = await post(`${getServerUrl(config.serverUrl)}/audio/transcriptions`, config.apiKey, form, false)
  return {
    text: resp.text ?? '',
    segments: Array.isArray(resp.segments)
      ? resp.segments.map((s: any) => ({ start: s.start, end: s.end, text: s.text }))
      : undefined,
  }
}

/**
 * OpenAI 兼容的 /chat/completions + input_audio
 */
const transcribeByChat = async (config: AsrConfig, wavBase64: string, prompt?: string): Promise<AsrResult> => {
  // 阿里百炼要求 data URI，OpenAI 等要求裸 base64
  const isQwen = config.model.toLowerCase().includes('qwen') || config.serverUrl.includes('aliyuncs.com')
  const messages: any[] = []
  if (prompt) {
    // qwen3-asr 不接受字符串形式的 system content
    messages.push({ role: 'system', content: [{ type: 'text', text: prompt }] })
  }
  messages.push({
    role: 'user',
    content: [{
      type: 'input_audio',
      input_audio: {
        data: isQwen ? `data:audio/wav;base64,${wavBase64}` : wavBase64,
        format: 'wav',
      },
    }],
  })
  const body: Record<string, any> = {
    model: config.model,
    messages,
    stream: false,
    ...parseExtraBody(config.extraBody),
  }
  if (isQwen && config.language) {
    body.asr_options = { ...body.asr_options, language: config.language }
  }

  const resp = await post(`${getServerUrl(config.serverUrl)}/chat/completions`, config.apiKey, JSON.stringify(body), true)
  const content = resp.choices?.[0]?.message?.content
  let text: string
  if (typeof content === 'string') {
    text = content
  } else if (Array.isArray(content)) {
    text = content.map((c: any) => c.text ?? '').join('')
  } else {
    throw new Error('无法解析识别结果: ' + JSON.stringify(resp).slice(0, 200))
  }
  return { text }
}

export const transcribe = async (config: AsrConfig, wavBase64: string, prompt?: string): Promise<AsrResult> => {
  if (config.protocol === 'chat') {
    return await transcribeByChat(config, wavBase64, prompt)
  } else {
    return await transcribeByTranscriptions(config, base64ToBytes(wavBase64), prompt)
  }
}
