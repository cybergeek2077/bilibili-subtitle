import { TOTAL_HEIGHT_DEF, HEADER_HEIGHT, TOTAL_HEIGHT_MIN, TOTAL_HEIGHT_MAX, IFRAME_ID, STORAGE_ENV, DEFAULT_USE_PORT } from '@/consts/const'
import { AllExtensionMessages, AllInjectMessages, AllAPPMessages } from '@/message-typings'
import { InjectMessaging } from '../message'
import { AsrJob, runAsrJob } from './asr'
import { ASR_URL_PREFIX, buildAsrInfo, getAsrCacheKey, getAsrConfig, isAsrConfigured } from '@/utils/asrUtil'
import { signWbi } from '@/utils/wbi'

const debug = (...args: any[]) => {
  console.debug('[Inject]', ...args)
}

(async function () {
  // 如果路径不是/video或/list，则不注入
  if (!location.pathname.startsWith('/video') && !location.pathname.startsWith('/list')) {
    debug('Not inject')
    return
  }

  // 读取envData
  const envDataStr = (await chrome.storage.sync.get(STORAGE_ENV))[STORAGE_ENV]
  let sidePanel: boolean | null = null
  let manualInsert: boolean | null = null
  if (envDataStr) {
    try {
      const envData = JSON.parse(envDataStr)
      debug('envData: ', envData)

      sidePanel = envData.sidePanel
      manualInsert = envData.manualInsert
    } catch (error) {
      console.error('Error parsing envData:', error)
    }
  }

  const runtime: {
    injectMessaging: InjectMessaging<AllExtensionMessages, AllInjectMessages, AllAPPMessages>
    // lastV?: string | null
    // lastVideoInfo?: VideoInfo

    fold: boolean

    videoElement?: HTMLVideoElement
    videoElementHeight: number

    showTrans: boolean
    curTrans?: string

    asrJob?: AsrJob
  } = {
    injectMessaging: new InjectMessaging(DEFAULT_USE_PORT),
    fold: true,
    videoElementHeight: TOTAL_HEIGHT_DEF,
    showTrans: false,
  }

  const getVideoElement = () => {
    const videoWrapper = document.getElementById('bilibili-player')
    return videoWrapper?.querySelector('video') as HTMLVideoElement | undefined
  }

  /**
   * @return if changed
   */
  const refreshVideoElement = () => {
    const newVideoElement = getVideoElement()
    const newVideoElementHeight = (newVideoElement != null) ? (Math.min(Math.max(newVideoElement.offsetHeight, TOTAL_HEIGHT_MIN), TOTAL_HEIGHT_MAX)) : TOTAL_HEIGHT_DEF
    if (newVideoElement === runtime.videoElement && Math.abs(newVideoElementHeight - runtime.videoElementHeight) < 1) {
      return false
    } else {
      runtime.videoElement = newVideoElement
      runtime.videoElementHeight = newVideoElementHeight
      // update iframe height
      updateIframeHeight()
      return true
    }
  }

  const createIframe = () => {
    var danmukuBox = document.getElementById('danmukuBox')
    if (danmukuBox) {
      var vKey = ''
      for (const key in danmukuBox?.dataset) {
        if (key.startsWith('v-')) {
          vKey = key
          break
        }
      }

      const iframe = document.createElement('iframe')
      iframe.id = IFRAME_ID
      iframe.src = chrome.runtime.getURL('index.html')
      iframe.style.border = 'none'
      iframe.style.width = '100%'
      iframe.style.height = '44px'
      iframe.style.marginBottom = '3px'
      iframe.allow = 'clipboard-read; clipboard-write;'

      if (vKey) {
        iframe.dataset[vKey] = danmukuBox?.dataset[vKey]
      }

      // insert before first child
      danmukuBox?.insertBefore(iframe, danmukuBox?.firstChild)

      // show badge
      runtime.injectMessaging.sendExtension('SHOW_FLAG', {
        show: true
      })

      debug('iframe inserted')

      return iframe
    }
  }

  if (!sidePanel && !manualInsert) {
    const timerIframe = setInterval(function () {
      var danmukuBox = document.getElementById('danmukuBox')
      if (danmukuBox) {
        clearInterval(timerIframe)

        // 延迟插入iframe（插入太快，网络较差时容易出现b站网页刷新，原因暂时未知，可能b站的某种机制？）
        setTimeout(createIframe, 1500)
      }
    }, 1000)
  }

  let aid: number | null = null
  let ctime: number | null = null
  let author: string | undefined
  let title = ''
  let bvid = ''
  let desc = ''
  let upMid: number | undefined
  let pages: any[] = []
  let pagesMap: Record<string, any> = {}

  /**
   * 有语音识别缓存时，把「语音识别」加到字幕列表末尾
   */
  const appendAsrInfo = async (subtitles: any[] | undefined, aid: number | null, cid: number | string | undefined | null) => {
    const list = [...(subtitles ?? [])]
    if (aid && cid) {
      const key = getAsrCacheKey(aid, cid)
      const cache = await chrome.storage.local.get(key)
      if (cache[key] != null) {
        list.push(buildAsrInfo(aid, cid))
      }
    }
    return list
  }

  let lastAidOrBvid: string | null = null
  const refreshVideoInfo = async (force: boolean = false) => {
    if (force) {
      lastAidOrBvid = null
    }
    if (!sidePanel) {
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | undefined
      if (!iframe) return
    }

    // fix: https://github.com/IndieKKY/bilibili-subtitle/issues/5
    // 处理稍后再看的url( https://www.bilibili.com/list/watchlater?bvid=xxx&oid=xxx )
    const pathSearchs: Record<string, string> = {}
    // eslint-disable-next-line no-return-assign
    location.search.slice(1).replace(/([^=&]*)=([^=&]*)/g, (matchs, a, b, c) => pathSearchs[a] = b)

    // bvid
    let aidOrBvid = pathSearchs.bvid // 默认为稍后再看
    if (!aidOrBvid) {
      let path = location.pathname
      if (path.endsWith('/')) {
        path = path.slice(0, -1)
      }
      const paths = path.split('/')
      aidOrBvid = paths[paths.length - 1]
    }

    if (aidOrBvid !== lastAidOrBvid) {
      // console.debug('refreshVideoInfo')

      lastAidOrBvid = aidOrBvid
      if (aidOrBvid) {
        // aid,pages
        let cid: string | undefined
        /**
         * [
    {
        "type": 2,
        "from": 0,
        "to": 152, //单位秒
        "content": "发现美",
        "imgUrl": "http://i0.hdslb.com/bfs/vchapter/29168372111_0.jpg",
        "logoUrl": "",
        "team_type": "",
        "team_name": ""
    }
]
         */
        let chapters: any[] = []
        let subtitles
        if (aidOrBvid.toLowerCase().startsWith('av')) { // avxxx
          aid = parseInt(aidOrBvid.slice(2))
          pages = await fetch(`https://api.bilibili.com/x/player/pagelist?aid=${aid}`, { credentials: 'include' }).then(async res => await res.json()).then(res => res.data)
          cid = pages[0].cid
          ctime = pages[0].ctime
          author = pages[0].owner?.name
          title = pages[0].part
          await fetch(`https://api.bilibili.com/x/web-interface/view?aid=${aid}`, { credentials: 'include' }).then(async res => await res.json()).then(res => {
            bvid = res.data?.bvid ?? ''
            desc = res.data?.desc ?? ''
            upMid = res.data?.owner?.mid
          })
          await fetch(`https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid!}`, { credentials: 'include' }).then(async res => await res.json()).then(res => {
            chapters = res.data.view_points ?? []
            subtitles = res.data.subtitle.subtitles
          })
        } else { // bvxxx
          await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${aidOrBvid}`, { credentials: 'include' }).then(async res => await res.json()).then(async res => {
            title = res.data.title
            aid = res.data.aid
            cid = res.data.cid
            ctime = res.data.ctime
            author = res.data.owner?.name
            pages = res.data.pages
            bvid = res.data.bvid
            desc = res.data.desc ?? ''
            upMid = res.data.owner?.mid
          })
          await fetch(`https://api.bilibili.com/x/player/wbi/v2?aid=${aid!}&cid=${cid!}`, { credentials: 'include' }).then(async res => await res.json()).then(res => {
            chapters = res.data.view_points ?? []
            subtitles = res.data.subtitle.subtitles
          })
        }

        // 筛选chapters里type为2的
        chapters = chapters.filter(chapter => chapter.type === 2)

        // pagesMap
        pagesMap = {}
        pages.forEach(page => {
          pagesMap[page.page + ''] = page
        })

        subtitles = await appendAsrInfo(subtitles, aid, cid)

        debug('refreshVideoInfo: ', aid, cid, pages, subtitles)

        // send setVideoInfo
        runtime.injectMessaging.sendApp(!!sidePanel, 'SET_VIDEO_INFO', {
          url: location.origin + location.pathname,
          title,
          aid,
          ctime,
          author,
          pages,
          chapters,
          infos: subtitles,
          desc: desc === '-' ? '' : desc,
        })
      }
    }
  }

  /**
   * B站官方 AI 总结(需要登录)
   */
  const fetchOfficialSummary = async (cid: number) => {
    let result: OfficialSummary
    try {
      const query = await signWbi({ bvid, cid, up_mid: upMid ?? '' })
      const res = await fetch(`https://api.bilibili.com/x/web-interface/view/conclusion/get?${query}`, { credentials: 'include' }).then(async res => await res.json())
      const modelResult = res.data?.model_result
      if (res.code === -101) {
        result = { status: 'unlogin' }
      } else if (res.code !== 0) {
        result = { status: 'error', message: `${res.code as string} ${res.message as string}` }
      } else if (res.data?.code === 0 && (modelResult?.summary || modelResult?.outline?.length > 0)) {
        result = {
          status: 'ok',
          summary: modelResult.summary ?? '',
          outline: (modelResult.outline ?? []).map((o: any) => ({
            title: o.title,
            timestamp: o.timestamp,
            points: (o.part_outline ?? []).map((p: any) => ({ content: p.content, timestamp: p.timestamp })),
          })),
        }
      } else {
        result = { status: 'none' }
      }
    } catch (e: any) {
      result = { status: 'error', message: e?.message ?? String(e) }
    }
    debug('officialSummary', cid, result)
    // 期间切换了分P则丢弃
    if (cid === lastCid) {
      runtime.injectMessaging.sendApp(!!sidePanel, 'SET_OFFICIAL_SUMMARY', { result }).catch(console.error)
    }
  }

  let lastAid: number | null = null
  let lastCid: number | null = null
  const refreshSubtitles = () => {
    if (!sidePanel) {
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | undefined
      if (!iframe) return
    }

    const urlSearchParams = new URLSearchParams(window.location.search)
    const p = urlSearchParams.get('p') || 1
    const page = pagesMap[p]
    if (!page) return
    const cid: number | null = page.cid

    if (aid !== lastAid || cid !== lastCid) {
      debug('refreshSubtitles', aid, cid)

      lastAid = aid
      lastCid = cid
      if (bvid && cid) {
        fetchOfficialSummary(cid).catch(console.error)
      }
      if (aid && cid) {
        fetch(`https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`, {
          credentials: 'include',
        })
          .then(async res => await res.json())
          .then(async res => {
            // remove elements with empty subtitle_url
            const subtitles = await appendAsrInfo(res.data.subtitle.subtitles.filter((item: any) => item.subtitle_url), aid, cid)
            if (subtitles.length > 0) {
              runtime.injectMessaging.sendApp(!!sidePanel, 'SET_INFOS', {
                infos: subtitles
              })
            }
          })
      }
    }
  }

  const updateIframeHeight = () => {
    const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | undefined
    if (iframe != null) {
      iframe.style.height = (runtime.fold ? HEADER_HEIGHT : runtime.videoElementHeight) + 'px'
    }
  }

  const asrMethods = {
    ASR_START: async () => {
      if (runtime.asrJob != null && !runtime.asrJob.cancelled) {
        throw new Error('正在识别中')
      }
      const envDataStr = (await chrome.storage.sync.get(STORAGE_ENV))[STORAGE_ENV]
      const envData: EnvData = envDataStr ? JSON.parse(envDataStr) : {}
      if (!isAsrConfigured(envData)) {
        throw new Error('请先在选项页面配置语音识别')
      }
      const p = new URLSearchParams(window.location.search).get('p') ?? '1'
      const page = pagesMap[p] ?? pages[0]
      if (!aid || !page?.cid) {
        throw new Error('未获取到视频信息')
      }
      const job: AsrJob = {
        aid,
        cid: page.cid,
        title: pages.length > 1 && page.part ? `${title} ${page.part as string}` : title,
        config: getAsrConfig(envData),
        cancelled: false,
      }
      runtime.asrJob = job
      const sendProgress = (status: AsrStatus) => {
        runtime.injectMessaging.sendApp(!!sidePanel, 'ASR_PROGRESS', { status }).catch(console.error)
      }

      runAsrJob(job, {
        onProgress: sendProgress,
        transcribe: async (audio, prompt) => await runtime.injectMessaging.sendExtension('ASR_TRANSCRIBE', {
          config: job.config,
          audio,
          prompt,
        }),
      }).then(async transcript => {
        const createdAt = Date.now()
        await chrome.storage.local.set({
          [getAsrCacheKey(job.aid, job.cid)]: { ...transcript, createdAt, model: job.config.model },
        })
        sendProgress({ status: 'done' })
        // 用户没切走才切换到识别结果
        if (aid === job.aid && lastCid === job.cid) {
          runtime.injectMessaging.sendApp(!!sidePanel, 'ASR_DONE', { info: buildAsrInfo(job.aid, job.cid) }).catch(console.error)
        }
      }).catch(e => {
        console.error('[ASR]', e)
        sendProgress(job.cancelled ? { status: 'cancelled' } : { status: 'error', message: e?.message ?? String(e) })
      }).finally(() => {
        if (runtime.asrJob === job) {
          runtime.asrJob = undefined
        }
      })
    },
    ASR_CANCEL: async () => {
      if (runtime.asrJob != null) {
        runtime.asrJob.cancelled = true
      }
    },
  }

  const methods: {
    [K in AllInjectMessages['method']]: (params: Extract<AllInjectMessages, { method: K }>['params'], context: MethodContext) => Promise<any>
  } = {
    TOGGLE_DISPLAY: async (params) => {
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | undefined
      if (iframe != null) {
        iframe.style.display = iframe.style.display === 'none' ? 'block' : 'none'
        runtime.injectMessaging.sendExtension('SHOW_FLAG', {
          show: iframe.style.display !== 'none'
        })
      } else {
        createIframe()
      }
    },
    FOLD: async (params) => {
      runtime.fold = params.fold
      updateIframeHeight()
    },
    MOVE: async (params) => {
      const video = getVideoElement()
      if (video != null) {
        video.currentTime = params.time
        if (params.togglePause) {
          video.paused ? video.play() : video.pause()
        }
      }
    },
    GET_SUBTITLE: async (params) => {
      let url = params.info.subtitle_url
      if (url.startsWith(ASR_URL_PREFIX)) {
        const [aid_, cid_] = url.slice(ASR_URL_PREFIX.length).split('/')
        const key = getAsrCacheKey(aid_, cid_)
        return (await chrome.storage.local.get(key))[key]
      }
      if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://')
      }
      return await fetch(url).then(async res => await res.json())
    },
    GET_VIDEO_STATUS: async (params) => {
      const video = getVideoElement()
      if (video != null) {
        return {
          paused: video.paused,
          currentTime: video.currentTime
        }
      }
    },
    GET_VIDEO_ELEMENT_INFO: async (params) => {
      refreshVideoElement()
      return {
        noVideo: runtime.videoElement == null,
        totalHeight: runtime.videoElementHeight,
      }
    },
    REFRESH_VIDEO_INFO: async (params) => {
      refreshVideoInfo(params.force)
    },
    UPDATE_TRANS_RESULT: async (params) => {
      runtime.showTrans = true
      runtime.curTrans = params?.result

      let text = document.getElementById('trans-result-text')
      if (text) {
        text.innerHTML = runtime.curTrans ?? ''
      } else {
        const container = document.getElementsByClassName('bpx-player-subtitle-panel-wrap')?.[0]
        if (container) {
          const div = document.createElement('div')
          div.style.display = 'flex'
          div.style.justifyContent = 'center'
          div.style.margin = '2px'
          text = document.createElement('text')
          text.id = 'trans-result-text'
          text.innerHTML = runtime.curTrans ?? ''
          text.style.fontSize = '1rem'
          text.style.padding = '5px'
          text.style.color = 'white'
          text.style.background = 'rgba(0, 0, 0, 0.4)'
          div.append(text)

          container.append(div)
        }
      }
      text && (text.style.display = runtime.curTrans ? 'block' : 'none')
    },
    HIDE_TRANS: async (params) => {
      runtime.showTrans = false
      runtime.curTrans = undefined

      const text = document.getElementById('trans-result-text')
      if (text) {
        text.style.display = 'none'
      }
    },
    PLAY: async (params) => {
      const { play } = params
      const video = getVideoElement()
      if (video != null) {
        if (play) {
          await video.play()
        } else {
          video.pause()
        }
      }
    },
    DOWNLOAD_AUDIO: async (params) => {
      const html = document.getElementsByTagName('html')[0].innerHTML
      const playInfo = JSON.parse(html.match(/window.__playinfo__=(.+?)<\/script/)?.[1] ?? '{}')
      const audioUrl = playInfo.data.dash.audio[0].baseUrl

      fetch(audioUrl).then(async res => await res.blob()).then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${title}.m4s`
        a.click()
      })
    },
    ...asrMethods,
  }

  // 初始化injectMessage
  runtime.injectMessaging.init(methods)

  setInterval(() => {
    if (!sidePanel) {
      const iframe = document.getElementById(IFRAME_ID) as HTMLIFrameElement | undefined
      if (!iframe || iframe.style.display === 'none') return
    }

    refreshVideoInfo().catch(console.error)
    refreshSubtitles()
  }, 1000)
})()
