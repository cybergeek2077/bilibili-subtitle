import React, {PropsWithChildren, useCallback, useMemo, useState} from 'react'
import {setEnvData} from '../redux/envReducer'
import {useAppDispatch, useAppSelector} from '../hooks/redux'
import {
  ASK_ENABLED_DEFAULT,
  ASR_CHUNK_SECONDS_DEFAULT,
  ASR_CONCURRENCY_DEFAULT,
  ASR_LANGUAGE_DEFAULT,
  ASR_LANGUAGES,
  ASR_PRESETS,
  CUSTOM_MODEL_TOKENS,
  DEFAULT_SERVER_URL_GEMINI,
  DEFAULT_SERVER_URL_OPENAI,
  LANGUAGE_DEFAULT,
  LANGUAGES,
  MODEL_DEFAULT,
  MODEL_MAP,
  MODEL_TIP,
  MODELS,
  PROMPT_DEFAULTS,
  PROMPT_TYPES,
  SUMMARIZE_LANGUAGE_DEFAULT,
  TRANSLATE_FETCH_DEFAULT,
  TRANSLATE_FETCH_MAX,
  TRANSLATE_FETCH_MIN,
  TRANSLATE_FETCH_STEP,
  WORDS_RATE,
} from '../consts/const'
import {IoWarning} from 'react-icons/all'
import classNames from 'classnames'
import toast from 'react-hot-toast'
import {useBoolean, useEventTarget} from 'ahooks'
import { FaChevronDown, FaChevronUp, FaGripfire } from 'react-icons/fa'
import { useMessage } from '@/hooks/useMessageService'
import useEventChecked from '@/hooks/useEventChecked'
import { bytesToBase64, encodeWav, ASR_SAMPLE_RATE } from '@/utils/audioUtil'

const OptionCard = ({ title, children, defaultExpanded = true }: { title: React.ReactNode, children: React.ReactNode, defaultExpanded?: boolean }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  return (
    <div className="card bg-base-200 shadow-xl mb-4">
      <div className="card-body p-4">
        <h2 className="card-title flex justify-between cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
          {title}
          {isExpanded ? <FaChevronUp /> : <FaChevronDown />}
        </h2>
        {isExpanded && <div className="mt-4">{children}</div>}
      </div>
    </div>
  )
}

const FormItem = (props: {
  title: ShowElement
  tip?: string
  htmlFor?: string
} & PropsWithChildren) => {
  const {title, tip, htmlFor, children} = props
  return (
    <div className='flex items-center gap-4 mb-2'>
      <div className={classNames('w-1/3 text-right', tip && 'tooltip tooltip-right z-50')} data-tip={tip}>
        <label className={classNames('font-medium', tip && 'border-b border-dotted border-current pb-[2px]')} htmlFor={htmlFor}>{title}</label>
      </div>
      <div className='w-2/3'>
        {children}
      </div>
    </div>
  )
}

const OptionsPage = () => {
  const dispatch = useAppDispatch()
  const envData = useAppSelector(state => state.env.envData)
  const {sendExtension} = useMessage(false)
  const {value: sidePanelValue, onChange: setSidePanelValue} = useEventChecked(envData.sidePanel)
  const {value: autoInsertValue, onChange: setAutoInsertValue} = useEventChecked(!envData.manualInsert)
  const {value: autoExpandValue, onChange: setAutoExpandValue} = useEventChecked(envData.autoExpand)
  // const {value: autoScrollValue, onChange: setAutoScrollValue} = useEventChecked(envData.autoScroll)
  const {value: translateEnableValue, onChange: setTranslateEnableValue} = useEventChecked(envData.translateEnable)
  const {value: summarizeEnableValue, onChange: setSummarizeEnableValue} = useEventChecked(envData.summarizeEnable)
  const {value: searchEnabledValue, onChange: setSearchEnabledValue} = useEventChecked(envData.searchEnabled)
  const {value: askEnabledValue, onChange: setAskEnabledValue} = useEventChecked(envData.askEnabled??ASK_ENABLED_DEFAULT)
  const {value: cnSearchEnabledValue, onChange: setCnSearchEnabledValue} = useEventChecked(envData.cnSearchEnabled)
  const {value: summarizeFloatValue, onChange: setSummarizeFloatValue} = useEventChecked(envData.summarizeFloat)
  const {value: chapterModeValue, onChange: setChapterModeValue} = useEventChecked(envData.chapterMode ?? true)
  const [apiKeyValue, { onChange: onChangeApiKeyValue }] = useEventTarget({initialValue: envData.apiKey??''})
  const [serverUrlValue, setServerUrlValue] = useState(envData.serverUrl)
  const [languageValue, { onChange: onChangeLanguageValue }] = useEventTarget({initialValue: envData.language??LANGUAGE_DEFAULT})
  const [modelValue, { onChange: onChangeModelValue }] = useEventTarget({initialValue: envData.model??MODEL_DEFAULT})
  const [customModelValue, { onChange: onChangeCustomModelValue }] = useEventTarget({initialValue: envData.customModel})
  const [customModelTokensValue, setCustomModelTokensValue] = useState(envData.customModelTokens)
  const [summarizeLanguageValue, { onChange: onChangeSummarizeLanguageValue }] = useEventTarget({initialValue: envData.summarizeLanguage??SUMMARIZE_LANGUAGE_DEFAULT})
  const [hideOnDisableAutoTranslateValue, setHideOnDisableAutoTranslateValue] = useState(envData.hideOnDisableAutoTranslate)
  const [themeValue, setThemeValue] = useState(envData.theme)
  const [fontSizeValue, setFontSizeValue] = useState(envData.fontSize)
  const [transDisplayValue, setTransDisplayValue] = useState(envData.transDisplay)
  const [wordsValue, setWordsValue] = useState<number | undefined>(envData.words)
  const [fetchAmountValue, setFetchAmountValue] = useState(envData.fetchAmount??TRANSLATE_FETCH_DEFAULT)
  const [promptsFold, {toggle: togglePromptsFold}] = useBoolean(true)
  const [promptsValue, setPromptsValue] = useState<{[key: string]: string}>(envData.prompts??{})
  const [asrProtocolValue, setAsrProtocolValue] = useState<AsrProtocol>(envData.asrProtocol ?? 'transcriptions')
  const [asrServerUrlValue, setAsrServerUrlValue] = useState(envData.asrServerUrl ?? '')
  const [asrApiKeyValue, setAsrApiKeyValue] = useState(envData.asrApiKey ?? '')
  const [asrModelValue, setAsrModelValue] = useState(envData.asrModel ?? '')
  const [asrLanguageValue, setAsrLanguageValue] = useState(envData.asrLanguage ?? ASR_LANGUAGE_DEFAULT)
  const [asrPromptValue, setAsrPromptValue] = useState(envData.asrPrompt ?? '')
  const [asrTimestampsValue, setAsrTimestampsValue] = useState(!!envData.asrTimestamps)
  const [asrExtraBodyValue, setAsrExtraBodyValue] = useState(envData.asrExtraBody ?? '')
  const [asrChunkSecondsValue, setAsrChunkSecondsValue] = useState<number | undefined>(envData.asrChunkSeconds)
  const [asrConcurrencyValue, setAsrConcurrencyValue] = useState<number | undefined>(envData.asrConcurrency)
  const {value: asrAutoValue, onChange: setAsrAutoValue} = useEventChecked(envData.asrAuto)
  const [asrKeyUrl, setAsrKeyUrl] = useState<string>()
  const [asrTesting, setAsrTesting] = useState(false)

  const applyAsrPreset = useCallback((preset: typeof ASR_PRESETS[number]) => {
    setAsrProtocolValue(preset.protocol)
    setAsrServerUrlValue(preset.serverUrl)
    setAsrModelValue(preset.model)
    setAsrTimestampsValue(preset.timestamps)
    setAsrChunkSecondsValue(preset.chunkSeconds)
    setAsrConcurrencyValue(preset.concurrency)
    setAsrPromptValue(preset.prompt ?? '')
    setAsrExtraBodyValue(preset.extraBody ?? '')
    setAsrKeyUrl(preset.keyUrl)
  }, [])

  const onTestAsr = useCallback(() => {
    if (!asrServerUrlValue || !asrModelValue) {
      toast.error('请填写服务器和模型')
      return
    }
    setAsrTesting(true)
    // 1 秒静音，只验证地址、密钥和模型是否可用
    const audio = bytesToBase64(encodeWav(new Int16Array(ASR_SAMPLE_RATE)))
    sendExtension(null, 'ASR_TRANSCRIBE', {
      config: {
        protocol: asrProtocolValue,
        serverUrl: asrServerUrlValue.trim(),
        apiKey: asrApiKeyValue.trim(),
        model: asrModelValue.trim(),
        language: asrLanguageValue,
        timestamps: asrTimestampsValue,
        extraBody: asrExtraBodyValue,
        chunkSeconds: ASR_CHUNK_SECONDS_DEFAULT,
        concurrency: 1,
      },
      audio,
    }).then(() => {
      toast.success('连接成功')
    }).catch((e: any) => {
      toast.error('连接失败: ' + (e?.message ?? String(e)), { duration: 8000 })
    }).finally(() => {
      setAsrTesting(false)
    })
  }, [asrApiKeyValue, asrExtraBodyValue, asrLanguageValue, asrModelValue, asrProtocolValue, asrServerUrlValue, asrTimestampsValue, sendExtension])
  // const wordsList = useMemo(() => {
  //   const list = []
  //   for (let i = WORDS_MIN; i <= WORDS_MAX; i += WORDS_STEP) {
  //     list.push(i)
  //   }
  //   return list
  // }, [])
  const transFetchAmountList = useMemo(() => {
    const list = []
    for (let i = TRANSLATE_FETCH_MIN; i <= TRANSLATE_FETCH_MAX; i += TRANSLATE_FETCH_STEP) {
      list.push(i)
    }
    return list
  }, [])
  const apiKeySetted = useMemo(() => {
    return !!apiKeyValue
  }, [apiKeyValue])

  const onChangeHideOnDisableAutoTranslate = useCallback((e: any) => {
    setHideOnDisableAutoTranslateValue(e.target.checked)
  }, [])

  const onSave = useCallback(() => {
    dispatch(setEnvData({
      sidePanel: sidePanelValue,
      manualInsert: !autoInsertValue,
      autoExpand: autoExpandValue,
      apiKey: apiKeyValue,
      serverUrl: serverUrlValue,
      model: modelValue,
      customModel: customModelValue,
      customModelTokens: customModelTokensValue,
      translateEnable: translateEnableValue,
      language: languageValue,
      hideOnDisableAutoTranslate: hideOnDisableAutoTranslateValue,
      theme: themeValue,
      transDisplay: transDisplayValue,
      summarizeEnable: summarizeEnableValue,
      summarizeFloat: summarizeFloatValue,
      summarizeLanguage: summarizeLanguageValue,
      words: wordsValue,
      fetchAmount: fetchAmountValue,
      fontSize: fontSizeValue,
      prompts: promptsValue,
      searchEnabled: searchEnabledValue,
      cnSearchEnabled: cnSearchEnabledValue,
      askEnabled: askEnabledValue,
      chapterMode: chapterModeValue,
      asrProtocol: asrProtocolValue,
      asrServerUrl: asrServerUrlValue.trim(),
      asrApiKey: asrApiKeyValue.trim(),
      asrModel: asrModelValue.trim(),
      asrLanguage: asrLanguageValue,
      asrPrompt: asrPromptValue,
      asrTimestamps: asrTimestampsValue,
      asrExtraBody: asrExtraBodyValue,
      asrChunkSeconds: asrChunkSecondsValue,
      asrConcurrency: asrConcurrencyValue,
      asrAuto: asrAutoValue,
    }))
    toast.success('保存成功')
    sendExtension(null, 'CLOSE_SIDE_PANEL')
    // 3秒后关闭
    setTimeout(() => {
      window.close()
    }, 3000)
  }, [dispatch, sendExtension, sidePanelValue, autoInsertValue, autoExpandValue, apiKeyValue, serverUrlValue, modelValue, customModelValue, customModelTokensValue, translateEnableValue, languageValue, hideOnDisableAutoTranslateValue, themeValue, transDisplayValue, summarizeEnableValue, summarizeFloatValue, summarizeLanguageValue, wordsValue, fetchAmountValue, fontSizeValue, promptsValue, searchEnabledValue, cnSearchEnabledValue, askEnabledValue, chapterModeValue, asrProtocolValue, asrServerUrlValue, asrApiKeyValue, asrModelValue, asrLanguageValue, asrPromptValue, asrTimestampsValue, asrExtraBodyValue, asrChunkSecondsValue, asrConcurrencyValue, asrAutoValue])

  const onCancel = useCallback(() => {
    window.close()
  }, [])

  const onFetchAmountChange = useCallback((e: any) => {
    setFetchAmountValue(parseInt(e.target.value))
  }, [])

  const onWordsChange = useCallback((e: any) => {
    setWordsValue(parseInt(e.target.value))
  }, [])

  const onSel1 = useCallback(() => {
    setTransDisplayValue('originPrimary')
  }, [])

  const onSel2 = useCallback(() => {
    setTransDisplayValue('targetPrimary')
  }, [])

  const onSel3 = useCallback(() => {
    setTransDisplayValue('target')
  }, [])

  const onSelTheme1 = useCallback(() => {
    setThemeValue('system')
  }, [])

  const onSelTheme2 = useCallback(() => {
    setThemeValue('light')
  }, [])

  const onSelTheme3 = useCallback(() => {
    setThemeValue('dark')
  }, [])

  const onSelFontSize1 = useCallback(() => {
    setFontSizeValue('normal')
  }, [])

  const onSelFontSize2 = useCallback(() => {
    setFontSizeValue('large')
  }, [])

  return (
    <div className='container mx-auto max-w-3xl p-4'>
      <OptionCard title="通用配置">
        <FormItem title='侧边栏' htmlFor='sidePanel' tip='字幕列表是否显示在侧边栏'>
          <input id='sidePanel' type='checkbox' className='toggle toggle-primary' checked={sidePanelValue}
                 onChange={setSidePanelValue}/>
        </FormItem>
        {!sidePanelValue && <FormItem title='自动插入' htmlFor='autoInsert' tip='是否自动插入字幕列表(可以手动点击扩展图标插入)'>
          <input id='autoInsert' type='checkbox' className='toggle toggle-primary' checked={autoInsertValue}
                 onChange={setAutoInsertValue}/>
        </FormItem>}
        {!sidePanelValue && <FormItem title='自动展开' htmlFor='autoExpand' tip='是否视频有字幕时自动展开字幕列表'>
          <input id='autoExpand' type='checkbox' className='toggle toggle-primary' checked={autoExpandValue}
                 onChange={setAutoExpandValue}/>
        </FormItem>}
        <FormItem title='章节模式' htmlFor='chapterMode' tip='如果视频包含章节，则会按章节分割(会导致总结只能按章节来)'>
          <input id='chapterMode' type='checkbox' className='toggle toggle-primary' checked={chapterModeValue}
                 onChange={setChapterModeValue}/>
        </FormItem>
        <FormItem title='主题'>
          <div className="btn-group">
            <button onClick={onSelTheme1} className={classNames('btn btn-sm no-animation', (!themeValue || themeValue === 'system')?'btn-active':'')}>系统</button>
            <button onClick={onSelTheme2} className={classNames('btn btn-sm no-animation', themeValue === 'light'?'btn-active':'')}>浅色</button>
            <button onClick={onSelTheme3} className={classNames('btn btn-sm no-animation', themeValue === 'dark'?'btn-active':'')}>深色</button>
          </div>
        </FormItem>
        <FormItem title='字体大小'>
          <div className="btn-group">
            <button onClick={onSelFontSize1} className={classNames('btn btn-sm no-animation', (!fontSizeValue || fontSizeValue === 'normal')?'btn-active':'')}>普通</button>
            <button onClick={onSelFontSize2} className={classNames('btn btn-sm no-animation', fontSizeValue === 'large'?'btn-active':'')}>加大</button>
          </div>
        </FormItem>
      </OptionCard>

      <OptionCard title="AI 配置">
        {<FormItem title='ApiKey' htmlFor='apiKey'>
          <input id='apiKey' type='text' className='input input-sm input-bordered w-full' placeholder='sk-xxx'
                 value={apiKeyValue} onChange={onChangeApiKeyValue}/>
        </FormItem>}
        {<FormItem title='服务器' htmlFor='serverUrl'>
          <input id='serverUrl' type='text' className='input input-sm input-bordered w-full'
                 placeholder={DEFAULT_SERVER_URL_OPENAI} value={serverUrlValue}
                 onChange={e => setServerUrlValue(e.target.value)}/>
        </FormItem>}
        {<div>
          <div className='desc text-sm text-center'>
            <div className='flex justify-center font-semibold'>【OpenAI官方地址】</div>
            <div>官方网址：<a className='link link-primary' href='https://platform.openai.com/' target='_blank'
                             rel="noreferrer">点击访问</a></div>
            <div>服务器地址：<a className='link link-primary'
                               onClick={() => setServerUrlValue(DEFAULT_SERVER_URL_OPENAI)}
                               rel='noreferrer'>点击设置</a></div>
            <div className='flex justify-center font-semibold'>【Gemini官方地址】</div>
            <div>官方网址：<a className='link link-primary' href='https://aistudio.google.com/apikey' target='_blank'
                             rel="noreferrer">点击访问</a></div>
            <div>服务器地址：<a className='link link-primary'
                               onClick={() => setServerUrlValue(DEFAULT_SERVER_URL_GEMINI)}
                               rel='noreferrer'>点击设置</a></div>
            <div className='flex justify-center font-semibold'>【第三方国内代理】</div>
            <div>代理网址：<a className='link link-primary' href='https://api.kksj.org/register?aff=ucVc'
                             target='_blank'
                             rel="noreferrer">点击访问</a></div>
            <div>服务器地址：<a className='link link-primary'
                               onClick={() => setServerUrlValue('https://api.kksj.org')}
                               rel='noreferrer'>点击设置</a></div>
            <div className='text-amber-600 flex justify-center items-center'><FaGripfire/>目前0.9人民币可充值1美元(约官方价格1/8)<FaGripfire/></div>
            <div className='text-amber-600 flex justify-center items-center'><FaGripfire/>国内可访问，无需🪜<FaGripfire/></div>
          </div>
        </div>}
        {<FormItem title='模型选择' htmlFor='modelSel' tip='注意，不同模型有不同价格与token限制'>
          <select id='modelSel' className="select select-sm select-bordered" value={modelValue}
                  onChange={onChangeModelValue}>
            {MODELS.map(model => <option key={model.code} value={model.code}>{model.name}</option>)}
          </select>
        </FormItem>}
        {<div className='desc text-sm'>
          {MODEL_TIP}
        </div>}
        {modelValue === 'custom' && <FormItem title='模型名' htmlFor='customModel'>
          <input id='customModel' type='text' className='input input-sm input-bordered w-full' placeholder='llama2'
                 value={customModelValue} onChange={onChangeCustomModelValue}/>
        </FormItem>}
        {modelValue === 'custom' && <FormItem title='Token上限' htmlFor='customModelTokens'>
          <input id='customModelTokens' type='number' className='input input-sm input-bordered w-full'
                 placeholder={'' + CUSTOM_MODEL_TOKENS}
                 value={customModelTokensValue}
                 onChange={e => setCustomModelTokensValue(e.target.value ? parseInt(e.target.value) : undefined)}/>
        </FormItem>}
      </OptionCard>

      <OptionCard title="语音识别配置">
        <div className='desc text-sm mb-3'>视频没有字幕时，下载音频并识别生成字幕，之后可正常总结、翻译。识别结果会缓存，同一视频不重复识别。</div>
        <FormItem title='快速填充'>
          <div className='flex flex-wrap gap-1'>
            {ASR_PRESETS.map(preset => <button key={preset.name} className='btn btn-xs' title={preset.desc}
                                               onClick={() => applyAsrPreset(preset)}>{preset.name}</button>)}
          </div>
        </FormItem>
        {asrKeyUrl && <div className='desc text-sm text-center mb-2'>获取密钥：<a className='link link-primary' href={asrKeyUrl} target='_blank' rel='noreferrer'>{asrKeyUrl}</a></div>}
        <FormItem title='接口协议' tip='transcriptions: /audio/transcriptions(Whisper 类)；chat: /chat/completions 音频输入(qwen3-asr 等)'>
          <select className='select select-sm select-bordered' value={asrProtocolValue} onChange={e => setAsrProtocolValue(e.target.value as AsrProtocol)}>
            <option value='transcriptions'>OpenAI 语音转写 (/audio/transcriptions)</option>
            <option value='chat'>OpenAI 对话音频输入 (/chat/completions)</option>
          </select>
        </FormItem>
        <FormItem title='服务器' htmlFor='asrServerUrl'>
          <input id='asrServerUrl' type='text' className='input input-sm input-bordered w-full' placeholder='https://api.openai.com/v1'
                 value={asrServerUrlValue} onChange={e => setAsrServerUrlValue(e.target.value)}/>
        </FormItem>
        <FormItem title='ApiKey' htmlFor='asrApiKey' tip='本地服务可留空'>
          <input id='asrApiKey' type='password' className='input input-sm input-bordered w-full' placeholder='sk-xxx'
                 value={asrApiKeyValue} onChange={e => setAsrApiKeyValue(e.target.value)}/>
        </FormItem>
        <FormItem title='模型' htmlFor='asrModel'>
          <input id='asrModel' type='text' className='input input-sm input-bordered w-full' placeholder='whisper-1'
                 value={asrModelValue} onChange={e => setAsrModelValue(e.target.value)}/>
        </FormItem>
        <FormItem title='语言'>
          <select className='select select-sm select-bordered' value={asrLanguageValue} onChange={e => setAsrLanguageValue(e.target.value)}>
            {ASR_LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}
          </select>
        </FormItem>
        <FormItem title='提示词' htmlFor='asrPrompt' tip='帮助识别专有名词，{{title}} 会替换成视频标题'>
          <input id='asrPrompt' type='text' className='input input-sm input-bordered w-full' placeholder='视频标题：{{title}}'
                 value={asrPromptValue} onChange={e => setAsrPromptValue(e.target.value)}/>
        </FormItem>
        {asrProtocolValue === 'transcriptions' && <FormItem title='分句时间戳' htmlFor='asrTimestamps' tip='请求 verbose_json 获取每句时间(Whisper 支持)；不支持的服务按字数估算时间'>
          <input id='asrTimestamps' type='checkbox' className='toggle toggle-primary' checked={asrTimestampsValue}
                 onChange={e => setAsrTimestampsValue(e.target.checked)}/>
        </FormItem>}
        <FormItem title='分段时长(秒)' htmlFor='asrChunkSeconds' tip='音频按静音切成不超过该时长的段分别识别；越短时间越准，请求越多'>
          <input id='asrChunkSeconds' type='number' min={5} max={600} className='input input-sm input-bordered w-full'
                 placeholder={'' + ASR_CHUNK_SECONDS_DEFAULT} value={asrChunkSecondsValue ?? ''}
                 onChange={e => setAsrChunkSecondsValue(e.target.value ? parseInt(e.target.value) : undefined)}/>
        </FormItem>
        <FormItem title='并发数' htmlFor='asrConcurrency'>
          <input id='asrConcurrency' type='number' min={1} max={20} className='input input-sm input-bordered w-full'
                 placeholder={'' + ASR_CONCURRENCY_DEFAULT} value={asrConcurrencyValue ?? ''}
                 onChange={e => setAsrConcurrencyValue(e.target.value ? parseInt(e.target.value) : undefined)}/>
        </FormItem>
        <FormItem title='额外参数' htmlFor='asrExtraBody' tip='JSON，合并进请求体'>
          <input id='asrExtraBody' type='text' className='input input-sm input-bordered w-full font-mono' placeholder='{"temperature": 0}'
                 value={asrExtraBodyValue} onChange={e => setAsrExtraBodyValue(e.target.value)}/>
        </FormItem>
        <FormItem title='自动识别' htmlFor='asrAuto' tip='视频没有字幕时自动开始识别(会产生费用)'>
          <input id='asrAuto' type='checkbox' className='toggle toggle-primary' checked={asrAutoValue}
                 onChange={setAsrAutoValue}/>
        </FormItem>
        <div className='flex justify-center'>
          <button className='btn btn-sm' disabled={asrTesting} onClick={onTestAsr}>{asrTesting ? '测试中...' : '测试连接'}</button>
        </div>
      </OptionCard>

      <OptionCard title={<div className='flex items-center'>
        翻译配置
        {!apiKeySetted && <div className='tooltip tooltip-right ml-1' data-tip='未设置ApiKey无法使用'>
          <IoWarning className='text-sm text-warning'/>
        </div>}
      </div>}>
        <FormItem title='启用翻译' htmlFor='translateEnable'>
          <input id='translateEnable' type='checkbox' className='toggle toggle-primary' checked={translateEnableValue}
                 onChange={setTranslateEnableValue}/>
        </FormItem>
        <FormItem title='目标语言' htmlFor='language'>
          <select id='language' className="select select-sm select-bordered" value={languageValue}
                  onChange={onChangeLanguageValue}>
            {LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}
          </select>
        </FormItem>
        <FormItem title='翻译条数' tip='每次翻译条数'>
          <div className='flex-1 flex flex-col'>
            <input type="range" min={TRANSLATE_FETCH_MIN} max={TRANSLATE_FETCH_MAX} step={TRANSLATE_FETCH_STEP} value={fetchAmountValue} className="range range-primary" onChange={onFetchAmountChange} />
            <div className="w-full flex justify-between text-sm px-2">
              {transFetchAmountList.map(amount => <span key={amount}>{amount}</span>)}
            </div>
          </div>
        </FormItem>
        <FormItem title='翻译显示'>
          <div className="btn-group">
            <button onClick={onSel1} className={classNames('btn btn-sm no-animation', (!transDisplayValue || transDisplayValue === 'originPrimary')?'btn-active':'')}>原文为主</button>
            <button onClick={onSel2} className={classNames('btn btn-sm no-animation', transDisplayValue === 'targetPrimary'?'btn-active':'')}>翻译为主</button>
            <button onClick={onSel3} className={classNames('btn btn-sm no-animation', transDisplayValue === 'target'?'btn-active':'')}>仅翻译</button>
          </div>
        </FormItem>
        <FormItem title='隐藏翻译' tip='取消自动翻译时,隐藏已翻译内容' htmlFor='hideOnDisableAutoTranslate'>
          <input id='hideOnDisableAutoTranslate' type='checkbox' className='toggle toggle-primary' checked={hideOnDisableAutoTranslateValue}
                 onChange={onChangeHideOnDisableAutoTranslate}/>
        </FormItem>
      </OptionCard>
      <OptionCard title={<div className='flex items-center'>
        总结配置
        {!apiKeySetted && <div className='tooltip tooltip-right ml-1' data-tip='未设置ApiKey无法使用'>
          <IoWarning className='text-sm text-warning'/>
        </div>}
      </div>}>
        <FormItem title='启用总结' htmlFor='summarizeEnable'>
          <input id='summarizeEnable' type='checkbox' className='toggle toggle-primary' checked={summarizeEnableValue}
                 onChange={setSummarizeEnableValue}/>
        </FormItem>
        <FormItem title='浮动窗口' htmlFor='summarizeFloat' tip='当前总结离开视野时,是否显示浮动窗口'>
          <input id='summarizeFloat' type='checkbox' className='toggle toggle-primary' checked={summarizeFloatValue}
                 onChange={setSummarizeFloatValue}/>
        </FormItem>
        <FormItem title='总结语言' htmlFor='summarizeLanguage'>
          <select id='summarizeLanguage' className="select select-sm select-bordered" value={summarizeLanguageValue} onChange={onChangeSummarizeLanguageValue}>
            {LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.name}</option>)}
          </select>
        </FormItem>
        <FormItem htmlFor='words' title='分段字数' tip='注意，不同模型有不同字数限制'>
          <div className='flex-1 flex flex-col'>
            <input id='words' type='number' className='input input-sm input-bordered w-full' placeholder={`默认为上限x${WORDS_RATE}`} value={wordsValue??''} onChange={e => setWordsValue(e.target.value?parseInt(e.target.value):undefined)}/>
            {/* <input type="range" min={WORDS_MIN} max={WORDS_MAX} step={WORDS_STEP} value={wordsValue} className="range range-primary" onChange={onWordsChange} /> */}
            {/* <div className="w-full flex justify-between text-sm px-2"> */}
            {/*  {wordsList.map(words => <span key={words}>{words}</span>)} */}
            {/* </div> */}
          </div>
        </FormItem>
        <div className='desc text-sm'>
          当前选择的模型的分段字数上限是<span className='font-semibold font-mono'>{MODEL_MAP[modelValue??MODEL_DEFAULT]?.tokens??'未知'}</span>
          （太接近上限总结会报错）
        </div>
      </OptionCard>
      <OptionCard title={<div className='flex items-center'>
        搜索配置
      </div>}>
        <FormItem title='启用搜索' htmlFor='searchEnabled' tip='是否启用字幕搜索功能'>
          <input id='searchEnabled' type='checkbox' className='toggle toggle-primary' checked={searchEnabledValue}
                 onChange={setSearchEnabledValue}/>
        </FormItem>
        <FormItem title='拼音搜索' htmlFor='cnSearchEnabled' tip='是否启用中文拼音搜索'>
          <input id='cnSearchEnabled' type='checkbox' className='toggle toggle-primary' checked={cnSearchEnabledValue}
                 onChange={setCnSearchEnabledValue}/>
        </FormItem>
      </OptionCard>
      <OptionCard title={<div className='flex items-center'>
        提问配置
      </div>}>
        <FormItem title='启用提问' htmlFor='askEnabled' tip='是否启用字幕提问功能'>
          <input id='askEnabled' type='checkbox' className='toggle toggle-primary' checked={askEnabledValue}
                 onChange={setAskEnabledValue}/>
        </FormItem>
      </OptionCard>

      <OptionCard title='提示词配置'>
        <div className='flex justify-center'>
          <a className='text-sm link link-primary' onClick={togglePromptsFold}>点击{promptsFold ? '展开' : '折叠'}</a>
        </div>
        {!promptsFold && PROMPT_TYPES.map((item, idx) => <FormItem key={item.type} title={<div>
          <div>{item.name}</div>
          <div className='link text-sm' onClick={() => {
            setPromptsValue({
              ...promptsValue,
              // @ts-expect-error
              [item.type]: PROMPT_DEFAULTS[item.type] ?? ''
            })
          }}>点击填充默认
          </div>
        </div>} htmlFor={`prompt-${item.type}`}>
          <textarea id={`prompt-${item.type}`} className='mt-2 textarea input-bordered w-full'
                    placeholder='留空使用默认提示词' value={promptsValue[item.type] ?? ''} onChange={(e) => {
                      setPromptsValue({
                        ...promptsValue,
                        [item.type]: e.target.value
                      })
                    }}/>
        </FormItem>)}
      </OptionCard>

      <div className='flex flex-col justify-center items-center gap-5 mt-6'>
        <button className='btn btn-primary btn-wide' onClick={onSave}>保存</button>
        <button className='btn btn-wide' onClick={onCancel}>取消</button>
      </div>
    </div>
  )
}

export default OptionsPage
