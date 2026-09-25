import { ASR_CHUNK_SECONDS_DEFAULT, ASR_CONCURRENCY_DEFAULT, ASR_LANGUAGE_DEFAULT } from '../consts/const'

// 单行字幕最长字数，超过就在逗号处再拆
const LINE_MAX_CHARS = 40

export const ASR_INFO_ID = 'asr'
export const ASR_URL_PREFIX = 'asr://'

export const getAsrCacheKey = (aid: number | string, cid: number | string) => `asr_cache_${aid}_${cid}`

export const buildAsrInfo = (aid: number | string, cid: number | string) => ({
  id: ASR_INFO_ID,
  lan: 'asr',
  lan_doc: '语音识别',
  subtitle_url: `${ASR_URL_PREFIX}${aid}/${cid}`,
})

export const isAsrConfigured = (envData: EnvData) => !!envData.asrServerUrl && !!envData.asrModel

export const getAsrConfig = (envData: EnvData): AsrConfig => ({
  protocol: envData.asrProtocol ?? 'transcriptions',
  serverUrl: envData.asrServerUrl ?? '',
  apiKey: envData.asrApiKey,
  model: envData.asrModel ?? '',
  language: envData.asrLanguage ?? ASR_LANGUAGE_DEFAULT,
  prompt: envData.asrPrompt,
  timestamps: envData.asrTimestamps,
  extraBody: envData.asrExtraBody,
  chunkSeconds: envData.asrChunkSeconds ?? ASR_CHUNK_SECONDS_DEFAULT,
  concurrency: envData.asrConcurrency ?? ASR_CONCURRENCY_DEFAULT,
})

const countChars = (s: string) => s.replace(/[\s，。！？；、,.!?;:：…"“”'‘’()（）-]/g, '').length || 1

/**
 * 把一段识别文本拆成字幕行，按字数在 [from, to] 内线性分配时间
 */
export const textToLines = (text: string, from: number, to: number): Array<{ from: number, to: number, content: string }> => {
  text = text.trim()
  if (!text) return []

  // 先按句末标点拆
  const sentences = text.match(/[^。！？!?；;…]+[。！？!?；;…]*["”’」』）)]*/g) ?? [text]
  // 过长的句子按逗号再拆，还长就硬切
  const lines: string[] = []
  for (let sentence of sentences) {
    sentence = sentence.trim()
    if (!sentence) continue
    if (sentence.length <= LINE_MAX_CHARS) {
      lines.push(sentence)
      continue
    }
    let buf = ''
    for (const part of sentence.match(/[^，,、]+[，,、]*/g) ?? [sentence]) {
      if (buf && (buf + part).length > LINE_MAX_CHARS) {
        lines.push(buf)
        buf = ''
      }
      buf += part
      while (buf.length > LINE_MAX_CHARS * 1.5) {
        lines.push(buf.slice(0, LINE_MAX_CHARS))
        buf = buf.slice(LINE_MAX_CHARS)
      }
    }
    if (buf) lines.push(buf)
  }

  const total = lines.reduce((sum, line) => sum + countChars(line), 0)
  const result = []
  let cur = from
  for (const line of lines) {
    const dur = (to - from) * countChars(line) / total
    result.push({ from: cur, to: cur + dur, content: line })
    cur += dur
  }
  return result
}
