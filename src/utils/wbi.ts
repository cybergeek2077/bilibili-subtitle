/**
 * B站 WBI 签名(部分接口必需)，参考 bilibili-API-collect/docs/misc/sign/wbi.md
 */

const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
]

// wbi key 每天更新，缓存一小时
const KEY_TTL = 60 * 60 * 1000
let cachedKey: { key: string, time: number } | undefined

/**
 * MD5(UTF-8)，返回 32 位小写十六进制
 */
export const md5 = (str: string): string => {
  const bytes = new TextEncoder().encode(str)
  const len = bytes.length
  const words = new Uint32Array((((len + 8) >>> 6) + 1) * 16)
  for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8)
  words[len >> 2] |= 0x80 << ((len % 4) * 8)
  words[words.length - 2] = len * 8
  words[words.length - 1] = Math.floor(len / 0x20000000)

  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21]
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000) >>> 0)
  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476
  for (let off = 0; off < words.length; off += 16) {
    let a = a0
    let b = b0
    let c = c0
    let d = d0
    for (let i = 0; i < 64; i++) {
      let f: number
      let g: number
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }
      const s = S[(i >> 4) * 4 + (i % 4)]
      const x = (a + f + K[i] + words[off + g]) >>> 0
      a = d
      d = c
      c = b
      b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0
    }
    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }
  return [a0, b0, c0, d0].map(n => {
    let hex = ''
    for (let i = 0; i < 4; i++) hex += ((n >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
    return hex
  }).join('')
}

export const getMixinKey = (imgKey: string, subKey: string) => {
  const raw = imgKey + subKey
  return MIXIN_KEY_ENC_TAB.map(i => raw[i]).join('').slice(0, 32)
}

const getWbiKey = async (): Promise<string> => {
  if (cachedKey != null && Date.now() - cachedKey.time < KEY_TTL) {
    return cachedKey.key
  }
  const res = await fetch('https://api.bilibili.com/x/web-interface/nav', { credentials: 'include' }).then(async res => await res.json())
  const fileName = (url: string) => url.slice(url.lastIndexOf('/') + 1).split('.')[0]
  const key = getMixinKey(fileName(res.data.wbi_img.img_url), fileName(res.data.wbi_img.sub_url))
  cachedKey = { key, time: Date.now() }
  return key
}

export const buildWbiQuery = (params: Record<string, string | number>, mixinKey: string, wts = Math.floor(Date.now() / 1000)) => {
  const all: Record<string, string | number> = { ...params, wts }
  const query = Object.keys(all).sort().map(k => {
    const value = String(all[k]).replace(/[!'()*]/g, '')
    return `${encodeURIComponent(k)}=${encodeURIComponent(value)}`
  }).join('&')
  return `${query}&w_rid=${md5(query + mixinKey)}`
}

export const signWbi = async (params: Record<string, string | number>) => buildWbiQuery(params, await getWbiKey())
