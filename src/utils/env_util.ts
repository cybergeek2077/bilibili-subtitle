export const openUrl = (url?: string, target?: string, features?: string) => {
  if (url) {
    window.open(url, target, features)
  }
}

/**
 * 扩展被重新加载/更新后，已打开页面里的旧脚本会失去与扩展的连接
 */
export const isExtensionContextValid = () => {
  try {
    return !!chrome.runtime?.id
  } catch (e) {
    return false
  }
}

export const isContextInvalidatedError = (e: any) => String(e?.message ?? e).includes('Extension context invalidated')

export const isDarkMode = () => {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches
}
