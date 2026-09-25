import { setAsrStatus, setDesc, setOfficialSummary, setAuthor, setChapters, setCtime, setCurFetched, setCurInfo, setData, setInfos, setTitle, setUrl } from '@/redux/envReducer'
import { ASR_INFO_ID } from '@/utils/asrUtil'
import store from '@/store'
import toast from 'react-hot-toast'
import { useAppDispatch, useAppSelector } from './redux'
import { AllAPPMessages, AllExtensionMessages, AllInjectMessages } from '@/message-typings'
import { useMessaging, useMessagingService } from '../message'
import { useMemoizedFn } from 'ahooks'

const useMessageService = () => {
  const dispatch = useAppDispatch()
  const envData = useAppSelector((state) => state.env.envData)

  // methods
  const methodsFunc: () => {
    [K in AllAPPMessages['method']]: (params: Extract<AllAPPMessages, { method: K }>['params'], context: MethodContext) => Promise<any>
  } = useMemoizedFn(() => ({
    SET_INFOS: async (params, context: MethodContext) => {
      dispatch(setInfos(params.infos))
      dispatch(setCurInfo(undefined))
      dispatch(setCurFetched(false))
      dispatch(setData(undefined))
    },
    SET_VIDEO_INFO: async (params, context: MethodContext) => {
      dispatch(setChapters(params.chapters))
      dispatch(setInfos(params.infos))
      dispatch(setUrl(params.url))
      dispatch(setTitle(params.title))
      dispatch(setCtime(params.ctime))
      dispatch(setAuthor(params.author))
      dispatch(setDesc(params.desc))
      dispatch(setOfficialSummary(undefined))
      console.debug('video title: ', params.title)
    },
    SET_OFFICIAL_SUMMARY: async (params, context: MethodContext) => {
      dispatch(setOfficialSummary(params.result))
    },
    ASR_PROGRESS: async (params, context: MethodContext) => {
      const { status } = params
      dispatch(setAsrStatus(status.status === 'running' ? status : undefined))
      if (status.status === 'error') {
        toast.error('语音识别失败: ' + (status.message ?? ''))
      }
    },
    ASR_DONE: async (params, context: MethodContext) => {
      const infos = (store.getState().env.infos ?? []).filter((item: any) => item.id !== ASR_INFO_ID)
      infos.push(params.info)
      dispatch(setInfos(infos))
      dispatch(setCurInfo(params.info))
      dispatch(setCurFetched(false))
      dispatch(setData(undefined))
      toast.success('语音识别完成')
    },
  }))

  useMessagingService(!!envData.sidePanel, methodsFunc)
}

export default useMessageService
export const useMessage = useMessaging<AllExtensionMessages, AllInjectMessages>
