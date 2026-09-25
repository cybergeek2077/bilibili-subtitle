export const DEFAULT_USE_PORT = false

export const EVENT_EXPAND = 'expand'

export const APP_DOM_ID = 'bilibili-subtitle'

export const IFRAME_ID = 'bilibili-subtitle-iframe'

export const STORAGE_ENV = 'bilibili-subtitle_env'
export const STORAGE_TEMP = 'bilibili-subtitle_temp'

export const PROMPT_TYPE_TRANSLATE = 'translate'
export const PROMPT_TYPE_SUMMARIZE_OVERVIEW = 'summarize_overview'
export const PROMPT_TYPE_SUMMARIZE_KEYPOINT = 'summarize_keypoint'
export const PROMPT_TYPE_SUMMARIZE_QUESTION = 'summarize_question'
export const PROMPT_TYPE_SUMMARIZE_DEBATE = 'summarize_debate'
export const PROMPT_TYPE_SUMMARIZE_BRIEF = 'summarize_brief'
export const PROMPT_TYPE_ASK = 'ask'
export const PROMPT_TYPES = [{
  name: '翻译',
  type: PROMPT_TYPE_TRANSLATE,
}, {
  name: '概览',
  type: PROMPT_TYPE_SUMMARIZE_OVERVIEW,
}, {
  name: '要点',
  type: PROMPT_TYPE_SUMMARIZE_KEYPOINT,
}, {
  name: '总结',
  type: PROMPT_TYPE_SUMMARIZE_BRIEF,
}, {
  name: '问题',
  type: PROMPT_TYPE_SUMMARIZE_QUESTION,
}, {
  name: '辩论',
  type: PROMPT_TYPE_SUMMARIZE_DEBATE,
}, {
  name: '提问',
  type: PROMPT_TYPE_ASK,
}]

export const SUMMARIZE_TYPES = {
  brief: {
    name: '总结',
    desc: '详细总结',
    downloadName: '💡视频总结💡',
    promptType: PROMPT_TYPE_SUMMARIZE_BRIEF,
  },
  overview: {
    name: '概览',
    desc: '可定位到视频位置',
    downloadName: '💡视频概览💡',
    promptType: PROMPT_TYPE_SUMMARIZE_OVERVIEW,
  },
  keypoint: {
    name: '要点',
    desc: '完整的要点提取',
    downloadName: '💡视频要点💡',
    promptType: PROMPT_TYPE_SUMMARIZE_KEYPOINT,
  },
  question: {
    name: '问题',
    desc: '常见问题',
    downloadName: '💡常见问题💡',
    promptType: PROMPT_TYPE_SUMMARIZE_QUESTION,
  },
  debate: {
    name: '辩论',
    desc: '辩论',
    downloadName: '💡辩论💡',
    promptType: PROMPT_TYPE_SUMMARIZE_DEBATE,
  },
}

export const PROMPT_DEFAULTS = {
  [PROMPT_TYPE_TRANSLATE]: `You are a professional translator. Translate following video subtitles to language '{{language}}'.
Preserve incomplete sentence.
Translate in the same json format.
Answer in markdown json format.

video subtitles:

\`\`\`
{{subtitles}}
\`\`\``,
  [PROMPT_TYPE_SUMMARIZE_OVERVIEW]: `你是一位擅长整理视频内容的编辑。请按时间顺序提炼下面这段视频字幕的关键节点，使用语言 '{{language}}'。

要求：
- 覆盖整段内容，从开头到结尾都要有节点，大约每 1~2 分钟一个（这段约 {{minutes}} 分钟，建议 {{count}} 个左右，内容密集可以更多）。
- key 用 1~2 句话写清楚这一段具体讲了什么：保留关键论点、数据、例子、结论等信息，不要写「介绍了……」「讲述了……」这种空话。
- time 取字幕里这部分内容开始处的时间戳，格式与字幕一致（MM:SS 或 HH:MM:SS）。
- emoji 与该节点内容相关，只用 1 个。
- 广告口播不要展开，用一个节点简短注明即可（emoji 用 📢）。
- 字幕可能由语音识别生成，含有同音错字，请结合上下文理解，输出时用正确的写法。
- 只输出 JSON，放在 markdown 代码块里。

输出格式示例：

\`\`\`json
[
  {
    "time": "03:00",
    "emoji": "👍",
    "key": "节点内容"
  }
]
\`\`\`

视频标题：{{title}}
视频简介：{{desc}}

字幕：

'''
{{subtitles}}
'''`,
  [PROMPT_TYPE_SUMMARIZE_KEYPOINT]: `你是一位擅长整理视频内容的编辑。请从下面的视频字幕中提炼要点，使用语言 '{{language}}'。

要求：
- 列出视频中所有重要的观点、知识点、结论、方法步骤和关键数据，按视频中出现的顺序排列，数量根据信息量决定（这段约 {{minutes}} 分钟，一般 {{keypointCount}} 条左右）。
- 每条是一个完整、具体的句子，读者不看视频也能明白；需要时写出原因、条件或例子。
- 不要写「视频介绍了……」这类空泛的概括；忽略求三连、广告等与主题无关的内容。
- 字幕可能由语音识别生成，含有同音错字，请结合上下文理解，输出时用正确的写法。
- 只输出 JSON 字符串数组，放在 markdown 代码块里。

输出格式示例：

\`\`\`json
[
  "要点 1",
  "要点 2"
]
\`\`\`

视频标题：{{title}}
视频简介：{{desc}}

字幕：

'''
{{segment}}
'''`,
  [PROMPT_TYPE_SUMMARIZE_BRIEF]: `你是一位擅长整理视频内容的编辑。请根据下面的视频信息和字幕，写一份详细的视频总结，使用语言 '{{language}}'。

要求：
- 开头用一段话（2~4 句）概括视频的核心内容和结论。
- 然后按视频的逻辑顺序分成若干小节，每节用「### 小标题」开头，下面用列表写具体内容：关键论点、论据、数据、例子、步骤、人名和产品名等细节都要保留，不要只写空泛的概括。
- 如果视频有明确的观点、建议或结论，最后单独用「### 结论与观点」小节列出。
- 篇幅与信息量相称，一般在 {{minWords}} 字左右，内容多时可以更长。
- 字幕可能由语音识别生成，含有同音错字，请结合上下文理解，输出时用正确的写法。
- 忽略求三连、互动引导等无关内容；如果有广告口播，不要展开，只在最后用一行注明「含广告：xxx」。
- 直接输出 Markdown 正文，不要用代码块包裹，不要输出 JSON。

视频标题：{{title}}
视频简介：{{desc}}

字幕：

'''
{{segment}}
'''`,
  [PROMPT_TYPE_SUMMARIZE_QUESTION]: `You are a helpful assistant that skilled at extracting questions from video subtitle.

## Context

The video's title: '''{{title}}'''.
The video's description: '''{{desc}}'''.
The video's subtitles:

'''
{{segment}}
'''

## Command

Accurately extract key questions and their corresponding answers from the video subtitles based on the actual content provided. The number of questions should be between 3 and 5.

- Identify questions as sentences starting with interrogative words (e.g., "What", "How", "Why") and extract the following sentences that directly answer these questions.
- Include only those questions and answers that are relevant to the main points of the video, and ensure they cover different aspects of the video's content.
- If an answer spans multiple non-consecutive parts of the subtitles, concatenate them into a coherent response without adding any information not present in the subtitles.
- In cases where the number of potential Q&As exceeds 5, prioritize the most informative and directly answered ones.
- If clear questions and answers are not available in the subtitles, refrain from creating them and instead note the absence of direct Q&As.
- Answer in language '{{language}}'.
- Format the output in markdown json format, as specified.

## Output format

Provide an example to illustrate the expected output:

\`\`\`json
[
    {
        "q": "What is the main theme of the video?",
        "a": "The main theme of the video is explained as..."
    },
    {
        "q": "How is the topic developed?",
        "a": "The topic is developed through various examples, including..."
    }
]
\`\`\`
`,
  [PROMPT_TYPE_SUMMARIZE_DEBATE]: `You are a helpful assistant skilled at generating debates based on video subtitles.

## Context

The video's title: '''{{title}}'''.
The video's description: '''{{desc}}'''.
The video's subtitles:

'''
{{segment}}
'''

## Command

Please play the roles of both the affirmative and negative sides to discuss the author's viewpoint.
The conversation should consist of 10 rounds(5 sentences from the affirmative side, 5 sentences from the negative side.).
The tone should be straightforward.

Answer in language '{{language}}'.

## Output format

Provide an example to illustrate the expected output:

\`\`\`json
[
    {
        "side": "pro",
        "content": "xxx"
    },
    {
        "side": "con",
        "content": "xxx"
    }
]
\`\`\`
`,
  [PROMPT_TYPE_ASK]: `You are a helpful assistant who answers question related to video subtitles.
Answer in language '{{language}}'.

The video's title: '''{{title}}'''.
The video's description: '''{{desc}}'''.
The video's subtitles:

'''
{{segment}}
'''

Question: '''{{question}}'''
Answer:
`,
}

export const TASK_EXPIRE_TIME = 15*60*1000

export const PAGE_MAIN = 'main'
export const PAGE_SETTINGS = 'settings'

export const TRANSLATE_COOLDOWN = 5*1000
export const TRANSLATE_FETCH_DEFAULT = 15
export const TRANSLATE_FETCH_MIN = 5
export const TRANSLATE_FETCH_MAX = 25
export const TRANSLATE_FETCH_STEP = 5
export const LANGUAGE_DEFAULT = 'en'

export const TOTAL_HEIGHT_MIN = 400
export const TOTAL_HEIGHT_DEF = 520
export const TOTAL_HEIGHT_MAX = 800
export const HEADER_HEIGHT = 44
export const TITLE_HEIGHT = 24
export const SEARCH_BAR_HEIGHT = 32
export const RECOMMEND_HEIGHT = 36

export const WORDS_RATE = 0.75
export const WORDS_MIN = 500
export const WORDS_MAX = 16000
export const WORDS_STEP = 500
export const SUMMARIZE_THRESHOLD = 100
export const SUMMARIZE_LANGUAGE_DEFAULT = 'cn'
export const SUMMARIZE_ALL_THRESHOLD = 5
export const ASK_ENABLED_DEFAULT = true
export const ASR_CHUNK_SECONDS_DEFAULT = 30
export const ASR_CONCURRENCY_DEFAULT = 3
export const ASR_LANGUAGE_DEFAULT = 'zh'
export const ASR_RETRY = 2
export const ASR_LANGUAGES = [
  { code: '', name: '自动' },
  { code: 'zh', name: '中文' },
  { code: 'en', name: '英文' },
  { code: 'ja', name: '日文' },
  { code: 'ko', name: '韩文' },
  { code: 'yue', name: '粤语' },
]
export const ASR_PRESETS: Array<{
  name: string
  desc: string
  keyUrl?: string
  protocol: AsrProtocol
  serverUrl: string
  model: string
  timestamps: boolean
  chunkSeconds: number
  concurrency: number
  prompt?: string
  extraBody?: string
}> = [{
  name: '阿里百炼 qwen3-asr-flash',
  desc: '约 ¥0.8/小时，中文准确率高，视频标题会作为上下文帮助识别专有名词',
  keyUrl: 'https://bailian.console.aliyun.com/?tab=model#/api-key',
  protocol: 'chat',
  serverUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'qwen3-asr-flash',
  timestamps: false,
  chunkSeconds: 30,
  concurrency: 5,
  prompt: '视频标题：{{title}}',
  extraBody: '{"asr_options": {"enable_itn": true}}',
}, {
  name: '硅基流动 SenseVoice',
  desc: '免费模型，速度快',
  keyUrl: 'https://cloud.siliconflow.cn/account/ak',
  protocol: 'transcriptions',
  serverUrl: 'https://api.siliconflow.cn/v1',
  model: 'FunAudioLLM/SenseVoiceSmall',
  timestamps: false,
  chunkSeconds: 30,
  concurrency: 3,
}, {
  name: 'OpenAI Whisper',
  desc: '返回分句时间戳',
  keyUrl: 'https://platform.openai.com/api-keys',
  protocol: 'transcriptions',
  serverUrl: 'https://api.openai.com/v1',
  model: 'whisper-1',
  timestamps: true,
  chunkSeconds: 300,
  concurrency: 3,
  prompt: '以下是简体中文普通话的句子。{{title}}',
}, {
  name: 'Groq Whisper',
  desc: '有免费额度，返回分句时间戳',
  keyUrl: 'https://console.groq.com/keys',
  protocol: 'transcriptions',
  serverUrl: 'https://api.groq.com/openai/v1',
  model: 'whisper-large-v3-turbo',
  timestamps: true,
  chunkSeconds: 300,
  concurrency: 2,
  prompt: '以下是简体中文普通话的句子。{{title}}',
}, {
  name: '本地 / 自建服务',
  desc: 'faster-whisper-server、speaches 等提供 OpenAI 兼容接口的服务',
  protocol: 'transcriptions',
  serverUrl: 'http://localhost:8000/v1',
  model: '',
  timestamps: true,
  chunkSeconds: 120,
  concurrency: 2,
}]
export const DEFAULT_SERVER_URL_OPENAI = 'https://api.openai.com'
export const DEFAULT_SERVER_URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta/openai/'
export const CUSTOM_MODEL_TOKENS = 16385

export const MODEL_TIP = '推荐gpt-4o-mini，能力强，价格低，token上限大'
export const MODELS = [{
  code: 'gpt-4o-mini',
  name: 'gpt-4o-mini',
  tokens: 128000,
}, {
  code: 'gpt-3.5-turbo-0125',
  name: 'gpt-3.5-turbo-0125',
  tokens: 16385,
}, {
  code: 'custom',
  name: '自定义',
}]
export const MODEL_DEFAULT = MODELS[0].code
export const MODEL_MAP: {[key: string]: typeof MODELS[number]} = {}
for (const model of MODELS) {
  MODEL_MAP[model.code] = model
}

export const LANGUAGES = [{
  code: 'en',
  name: 'English',
}, {
  code: 'ja',
  name: '日本語',
}, {
  code: 'ena',
  name: 'American English',
}, {
  code: 'enb',
  name: 'British English',
}, {
  code: 'cn',
  name: '中文简体',
}, {
  code: 'cnt',
  name: '中文繁体',
}, {
  code: 'Spanish',
  name: 'español',
}, {
  code: 'French',
  name: 'Français',
}, {
  code: 'Arabic',
  name: 'العربية',
}, {
  code: 'Russian',
  name: 'русский',
}, {
  code: 'German',
  name: 'Deutsch',
}, {
  code: 'Portuguese',
  name: 'Português',
}, {
  code: 'Italian',
  name: 'Italiano',
}, {
  code: 'ko',
  name: '한국어',
}, {
  code: 'hi',
  name: 'हिन्दी',
}, {
  code: 'tr',
  name: 'Türkçe',
}, {
  code: 'nl',
  name: 'Nederlands',
}, {
  code: 'pl',
  name: 'Polski',
}, {
  code: 'sv',
  name: 'Svenska',
}, {
  code: 'vi',
  name: 'Tiếng Việt',
}, {
  code: 'th',
  name: 'ไทย',
}, {
  code: 'id',
  name: 'Bahasa Indonesia',
}, {
  code: 'el',
  name: 'Ελληνικά',
}, {
  code: 'he',
  name: 'עברית',
}]
export const LANGUAGES_MAP: {[key: string]: typeof LANGUAGES[number]} = {}
for (const language of LANGUAGES) {
  LANGUAGES_MAP[language.code] = language
}
