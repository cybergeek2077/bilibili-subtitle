import {DEFAULT_SERVER_URL_OPENAI} from '../consts/const'

export const getServerUrl = (serverUrl?: string) => {
  if (!serverUrl) {
    return DEFAULT_SERVER_URL_OPENAI
  }
  if (serverUrl.endsWith('/')) {
    serverUrl = serverUrl.slice(0, -1)
  }
  // 如果serverUrl以https://generativelanguage.googleapis.com开头，则直接返回
  if (serverUrl.toLowerCase().startsWith('https://generativelanguage.googleapis.com')) {
    return serverUrl
  }
  // 如果serverUrl不以/vxxx结尾，则添加/v1
  if (!/\/v\d+$/.test(serverUrl.toLowerCase())) {
    serverUrl += '/v1'
  }
  return serverUrl
}

export const handleChatCompleteTask = async (task: Task) => {
  const data = task.def.data
  const serverUrl = getServerUrl(task.def.serverUrl)
  const resp = await fetch(`${serverUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + task.def.extra.apiKey,
    },
    body: JSON.stringify(data),
  })
  task.resp = await resp.json()
  // 部分 OpenAI 兼容服务不返回 usage，以 choices 为准
  if (task.resp.choices?.length > 0) {
    return true
  } else if (task.resp.error != null) {
    throw new Error(`${task.resp.error.code as string ?? ''} ${task.resp.error.message as string ?? ''}`)
  } else {
    throw new Error(`请求失败(${resp.status}): ${JSON.stringify(task.resp).slice(0, 200)}`)
  }
}
