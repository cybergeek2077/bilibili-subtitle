import { ASR_RETRY } from '@/consts/const'
import { ASR_SAMPLE_RATE, bytesToBase64, decodeToPcm16k, encodeWav, splitBySilence, splitFragmentedMp4 } from '@/utils/audioUtil'
import { textToLines } from '@/utils/asrUtil'

// 探测音频地址的超时(PCDN 节点经常连不上)
const CONNECT_TIMEOUT = 10 * 1000
const DOWNLOAD_PART_SIZE = 1024 * 1024
const DOWNLOAD_CONCURRENCY = 4
const DOWNLOAD_PART_TIMEOUT = 20 * 1000
const DOWNLOAD_PART_RETRY = 3

export interface AsrJob {
  aid: number
  cid: number
  title: string
  config: AsrConfig
  cancelled: boolean
}

interface AsrJobCallbacks {
  onProgress: (status: AsrStatus) => void
  transcribe: (audio: string, prompt?: string) => Promise<AsrResult>
}

const sleep = async (ms: number) => await new Promise(resolve => setTimeout(resolve, ms))

const checkCancelled = (job: AsrJob) => {
  if (job.cancelled) throw new Error('已取消')
}

/**
 * 源站(upos)优先，PCDN(mcdn、:4483/:8082 端口)放最后
 */
const sortAudioUrls = (urls: string[]) => {
  const score = (url: string) => {
    try {
      const u = new URL(url)
      if (u.hostname.startsWith('upos-')) return 0
      if (u.hostname.includes('mcdn') || (u.port && u.port !== '443')) return 2
      return 1
    } catch (e) {
      return 3
    }
  }
  return [...new Set(urls)].sort((a, b) => score(a) - score(b))
}

const getAudioUrls = async (aid: number, cid: number): Promise<string[]> => {
  const query = `avid=${aid}&cid=${cid}&fnval=16&fnver=0&fourk=0`
  let data: any
  for (const api of ['x/player/playurl', 'x/player/wbi/playurl']) {
    const res = await fetch(`https://api.bilibili.com/${api}?${query}`, { credentials: 'include' }).then(async res => await res.json())
    if (res.code === 0 && res.data?.dash?.audio?.length > 0) {
      data = res.data
      break
    }
  }
  if (data == null) {
    throw new Error('获取音频地址失败')
  }
  // 码率最低的就够识别用了
  const audio = [...data.dash.audio].sort((a: any, b: any) => a.bandwidth - b.bandwidth)[0]
  return sortAudioUrls([audio.baseUrl ?? audio.base_url, ...(audio.backupUrl ?? audio.backup_url ?? [])].filter(Boolean))
}

/**
 * 下载一段(含响应体)，超时即放弃
 */
const fetchBytes = async (url: string, range: string | undefined, timeout: number) => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const resp = await fetch(url, {
      headers: range ? { Range: range } : undefined,
      signal: controller.signal,
    })
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`)
    }
    return { resp, bytes: new Uint8Array(await resp.arrayBuffer()) }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 分块并发下载：单个连接偶尔会卡住几十秒，分块后只需重试卡住的那块
 */
const downloadAudio = async (job: AsrJob, urls: string[], onProgress: (loaded: number, total: number) => void): Promise<Uint8Array> => {
  // 找一个能连上的地址，顺便拿到总大小
  let total = 0
  let lastError: any
  let available: string[] = []
  for (const url of urls) {
    checkCancelled(job)
    try {
      const { resp, bytes } = await fetchBytes(url, 'bytes=0-0', CONNECT_TIMEOUT)
      const size = parseInt(resp.headers.get('Content-Range')?.split('/')[1] ?? '0')
      if (resp.status === 206 && size > 0) {
        total = size
        // 其余地址留作重试备用
        available = [url, ...urls.filter(u => u !== url)]
        break
      } else if (resp.status === 200) {
        // 不支持分段请求，已经是完整文件
        onProgress(bytes.length, bytes.length)
        return bytes
      }
    } catch (e) {
      lastError = e
      console.warn('[ASR] 音频地址不可用', url, e)
    }
  }
  if (available.length === 0) {
    throw new Error('音频下载失败: ' + String(lastError?.message ?? lastError))
  }

  const result = new Uint8Array(total)
  const partCount = Math.ceil(total / DOWNLOAD_PART_SIZE)
  let next = 0
  let loaded = 0
  const worker = async () => {
    while (next < partCount) {
      const idx = next++
      const start = idx * DOWNLOAD_PART_SIZE
      const end = Math.min(total, start + DOWNLOAD_PART_SIZE) - 1
      for (let attempt = 0; ; attempt++) {
        checkCancelled(job)
        // 先在能用的地址上重试一次，再换备用地址
        const url = available[attempt < 2 ? 0 : (attempt - 1) % available.length]
        try {
          const { bytes } = await fetchBytes(url, `bytes=${start}-${end}`, DOWNLOAD_PART_TIMEOUT)
          if (bytes.length !== end - start + 1) {
            throw new Error(`长度不符 ${bytes.length}`)
          }
          result.set(bytes, start)
          loaded += bytes.length
          onProgress(loaded, total)
          break
        } catch (e) {
          if (attempt >= DOWNLOAD_PART_RETRY) {
            throw new Error('音频下载失败: ' + String((e as any)?.message ?? e))
          }
          console.warn(`[ASR] 第 ${idx + 1} 块下载失败，重试`, e)
        }
      }
    }
  }
  await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker))
  return result
}

export const runAsrJob = async (job: AsrJob, callbacks: AsrJobCallbacks): Promise<Transcript> => {
  const { config } = job
  const report = (stage: string, done?: number, total?: number) => {
    callbacks.onProgress({ status: 'running', stage, done, total })
  }

  report('获取音频')
  const urls = await getAudioUrls(job.aid, job.cid)

  const bytes = await downloadAudio(job, urls, (loaded, total) => {
    report('下载音频', Math.round(loaded / 1024), total > 0 ? Math.round(total / 1024) : undefined)
  })

  checkCancelled(job)
  report('解码音频')
  const pcm = await decodeToPcm16k(splitFragmentedMp4(bytes), (done, total) => report('解码音频', done, total))
  const chunks = splitBySilence(pcm, config.chunkSeconds)
  console.debug(`[ASR] 音频 ${(pcm.length / ASR_SAMPLE_RATE).toFixed(1)} 秒，切成 ${chunks.length} 段`)
  if (chunks.length === 0) {
    throw new Error('没有检测到人声')
  }

  const prompt = config.prompt?.replace(/\{\{title\}\}/g, job.title ?? '').trim()
  const results: Array<Array<{ from: number, to: number, content: string }>> = new Array(chunks.length)
  let finished = 0
  let failed = 0
  let next = 0
  report('识别中', 0, chunks.length)

  const worker = async () => {
    while (next < chunks.length) {
      checkCancelled(job)
      const idx = next++
      const chunk = chunks[idx]
      const from = chunk.start / ASR_SAMPLE_RATE
      const to = chunk.end / ASR_SAMPLE_RATE
      const audio = bytesToBase64(encodeWav(pcm.subarray(chunk.start, chunk.end)))
      let lastError: any
      for (let attempt = 0; attempt <= ASR_RETRY; attempt++) {
        checkCancelled(job)
        try {
          const result = await callbacks.transcribe(audio, prompt)
          if (result.segments != null && result.segments.length > 0) {
            results[idx] = result.segments
              .filter(s => s.text?.trim())
              .map(s => ({ from: from + s.start, to: Math.min(from + s.end, to), content: s.text.trim() }))
          } else {
            results[idx] = textToLines(result.text, from, to)
          }
          lastError = undefined
          break
        } catch (e) {
          lastError = e
          console.warn(`[ASR] 第 ${idx + 1} 段识别失败(第 ${attempt + 1} 次)`, e)
          await sleep(1000 * (attempt + 1) * 2)
        }
      }
      if (lastError != null) {
        failed++
        results[idx] = [{ from, to, content: `〔此段识别失败：${String(lastError?.message ?? lastError)}〕` }]
      }
      finished++
      report('识别中', finished, chunks.length)
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, config.concurrency) }, worker))

  if (failed === chunks.length) {
    throw new Error(results[0]?.[0]?.content ?? '识别失败')
  }

  const body = results.flat().map((item, idx) => ({ ...item, idx }))
  return { body }
}
