interface MethodContext {
  from: 'extension' | 'inject' | 'app'
  event: any
  tabId?: number
  // sender?: chrome.runtime.MessageSender | null
}

interface EnvData {
  sidePanel?: boolean
  manualInsert?: boolean // 是否手动插入字幕列表
  autoExpand?: boolean
  flagDot?: boolean

  // openai
  apiKey?: string
  serverUrl?: string
  model?: string
  customModel?: string
  customModelTokens?: number

  translateEnable?: boolean
  language?: string
  hideOnDisableAutoTranslate?: boolean
  transDisplay?: 'target' | 'originPrimary' | 'targetPrimary'
  fetchAmount?: number
  summarizeEnable?: boolean
  summarizeLanguage?: string
  words?: number
  summarizeFloat?: boolean
  theme?: 'system' | 'light' | 'dark'
  fontSize?: 'normal' | 'large'

  // chapter
  chapterMode?: boolean // 是否启用章节模式，undefined/null/true表示启用，false表示禁用

  // search
  searchEnabled?: boolean
  cnSearchEnabled?: boolean

  // ask
  askEnabled?: boolean

  prompts?: {
    [key: string]: string
  }

  // 语音识别(无字幕时从音频生成字幕)
  asrProtocol?: AsrProtocol
  asrServerUrl?: string
  asrApiKey?: string
  asrModel?: string
  asrLanguage?: string // 空表示自动
  asrPrompt?: string // 支持 {{title}}
  asrTimestamps?: boolean // 请求 verbose_json 分句时间戳(仅 transcriptions 协议)
  asrExtraBody?: string // 额外请求参数(JSON)
  asrChunkSeconds?: number
  asrConcurrency?: number
  asrAuto?: boolean // 无字幕时自动识别
}

/**
 * transcriptions: OpenAI 兼容的 /audio/transcriptions(Whisper、硅基流动 SenseVoice、Groq、本地服务等)
 * chat: OpenAI 兼容的 /chat/completions + input_audio(阿里百炼 qwen3-asr-flash、gpt-4o-audio 等)
 */
type AsrProtocol = 'transcriptions' | 'chat'

interface AsrConfig {
  protocol: AsrProtocol
  serverUrl: string
  apiKey?: string
  model: string
  language?: string
  prompt?: string
  timestamps?: boolean
  extraBody?: string
  chunkSeconds: number
  concurrency: number
}

interface AsrResult {
  text: string
  segments?: Array<{ start: number, end: number, text: string }>
}

/**
 * B站官方 AI 总结
 */
interface OfficialSummary {
  status: 'ok' | 'none' | 'unlogin' | 'error'
  message?: string
  summary?: string
  outline?: Array<{
    title: string
    timestamp: number
    points: Array<{ content: string, timestamp: number }>
  }>
}

interface AsrStatus {
  status: 'running' | 'done' | 'error' | 'cancelled'
  stage?: string // 当前阶段描述
  done?: number
  total?: number
  message?: string
}

interface TempData {
  curSummaryType: SummaryType
  downloadType?: string
  compact?: boolean // 是否紧凑视图
  reviewActions?: number // 点击或总结行为达到一定次数后，显示评分（一个视频最多只加1次）
  reviewed?: boolean // 是否点击过评分,undefined: 不显示；true: 已点击；false: 未点击(需要显示)
}

interface TaskDef {
  type: 'chatComplete'
  serverUrl?: string
  data: any
  extra?: any
}

interface Task {
  id: string
  startTime: number
  endTime?: number
  def: TaskDef

  status: 'pending' | 'running' | 'done'
  error?: string
  resp?: any
}

interface TransResult {
  // idx: number
  code?: '200' | '500'
  data?: string
}

type ShowElement = string | JSX.Element | undefined

interface Transcript {
  body: TranscriptItem[]
}

interface TranscriptItem {
  from: number
  to: number
  content: string

  idx: number
}

interface Chapter {
  from: number
  to: number
  content: string // 标题
}

interface Segment {
  items: TranscriptItem[]
  startIdx: number // 从1开始
  endIdx: number
  text: string
  fold?: boolean
  chapterTitle?: string // 章节标题
  summaries: {
    [type: string]: Summary
  }
}

interface OverviewItem {
  time: string
  emoji: string
  key: string
}

interface Summary {
  type: SummaryType

  status: SummaryStatus
  error?: string
  content?: any
}

interface AskInfo {
  id: string
  fold?: boolean
  question: string
  status: SummaryStatus
  error?: string
  content?: string
}

type PartialOfAskInfo = Partial<PartOfAskInfo>

/**
 * 概览
 */
interface OverviewSummary extends Summary {
  content?: OverviewItem[]
}

/**
 * 要点
 */
interface KeypointSummary extends Summary {
  content?: string[]
}

/**
 * 总结
 */
interface BriefSummary extends Summary {
  content?: {
    summary: string
  }
}

type SummaryStatus = 'init' | 'pending' | 'done'
type SummaryType = 'overview' | 'keypoint' | 'brief' | 'question' | 'debate'

interface DebateMessage {
  side: 'pro' | 'con'
  content: string
}

interface DebateProps {
  messages: DebateMessage[]
}
