import React, { useCallback, useState } from 'react'
import classNames from 'classnames'
import toast from 'react-hot-toast'
import { BsDashSquare, BsPlusSquare, RiFileCopy2Line } from 'react-icons/all'
import { useAppSelector } from '../hooks/redux'
import useSubtitle from '../hooks/useSubtitle'
import { formatTime } from '../utils/util'

const toText = (summary: OfficialSummary) => {
  let s = (summary.summary ?? '') + '\n'
  for (const section of summary.outline ?? []) {
    s += `\n${formatTime(section.timestamp)} ${section.title}\n`
    for (const point of section.points) {
      s += `- ${formatTime(point.timestamp)} ${point.content}\n`
    }
  }
  return s
}

/**
 * B站官方 AI 总结(视频页「AI小助手」的内容)
 */
const OfficialSummary = () => {
  const officialSummary = useAppSelector(state => state.env.officialSummary)
  const fontSize = useAppSelector(state => state.env.envData.fontSize)
  const [fold, setFold] = useState(false)
  const { move } = useSubtitle()

  const onCopy = useCallback(() => {
    if (officialSummary != null) {
      navigator.clipboard.writeText(toText(officialSummary)).then(() => {
        toast.success('已复制到剪贴板!')
      }).catch(console.error)
    }
  }, [officialSummary])

  if (officialSummary?.status === 'unlogin') {
    return <div className='desc-lighter text-xs text-center my-1'>登录 B 站后可显示官方 AI 总结</div>
  }
  if (officialSummary?.status !== 'ok') {
    return null
  }

  const textSize = fontSize === 'large' ? 'text-sm' : 'text-xs'
  return <div className='border border-base-300 bg-base-200/25 rounded flex flex-col m-1.5 p-1.5 gap-1'>
    <div className='relative flex justify-center items-center min-h-[20px]'>
      <div className='absolute left-0 top-0 bottom-0 text-xs select-none flex-center desc'>
        {fold
          ? <BsPlusSquare className='cursor-pointer' onClick={() => setFold(false)}/>
          : <BsDashSquare className='cursor-pointer' onClick={() => setFold(true)}/>}
      </div>
      <span className='text-xs font-semibold text-primary'>B站 AI 总结</span>
      <div className='absolute right-0 top-0 bottom-0 flex-center'>
        <RiFileCopy2Line className='desc cursor-pointer' title='复制' onClick={onCopy}/>
      </div>
    </div>
    {!fold && <div className={classNames('flex flex-col gap-1.5 px-1', textSize)}>
      {officialSummary.summary && <div className='font-medium'>{officialSummary.summary}</div>}
      {officialSummary.outline?.map((section, idx) => <div key={idx}>
        <div className='font-semibold cursor-pointer hover:text-primary' onClick={() => move(section.timestamp, false)}>
          <span className='bg-success/75 rounded-sm px-1 mr-1 font-normal'>{formatTime(section.timestamp)}</span>
          {section.title}
        </div>
        <ul className='list-none pl-2'>
          {section.points.map((point, pIdx) => <li key={pIdx}
                                                   className='cursor-pointer p-0.5 rounded-sm hover:bg-base-200'
                                                   onClick={() => move(point.timestamp, false)}>
            <span className='desc mr-1'>{formatTime(point.timestamp)}</span>
            {point.content}
          </li>)}
        </ul>
      </div>)}
    </div>}
  </div>
}

export default OfficialSummary
