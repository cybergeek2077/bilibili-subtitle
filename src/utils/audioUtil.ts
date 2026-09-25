/**
 * 音频处理：B站 DASH 音频(分片 mp4) -> 16k 单声道 PCM -> 按静音切段 -> WAV
 */

export const ASR_SAMPLE_RATE = 16000

// 每组分片数（B站音频一个分片约 5 秒，40 个约 3 分多钟，避免一次解码整段占用过多内存）
const FRAGS_PER_GROUP = 40
// 静音检测帧长 20ms
const FRAME_SIZE = ASR_SAMPLE_RATE / 50
// 平滑窗口 10 帧(200ms)
const SMOOTH_FRAMES = 10
// 整段都低于该能量(int16 平均绝对值)视为静音，不送识别
const SILENT_ENERGY = 150

interface Box {
  type: string
  start: number
  size: number
}

const readBoxes = (u8: Uint8Array): Box[] => {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength)
  const boxes: Box[] = []
  let offset = 0
  while (offset + 8 <= u8.length) {
    let size = dv.getUint32(offset)
    const type = String.fromCharCode(u8[offset + 4], u8[offset + 5], u8[offset + 6], u8[offset + 7])
    if (size === 1) {
      size = Number(dv.getBigUint64(offset + 8))
    } else if (size === 0) {
      size = u8.length - offset
    }
    if (size < 8) break
    boxes.push({ type, start: offset, size })
    offset += size
  }
  return boxes
}

const concatBytes = (parts: Uint8Array[]) => {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    result.set(p, offset)
    offset += p.length
  }
  return result
}

/**
 * 把分片 mp4 拆成若干可独立解码的小文件(初始化段 + 一组 moof/mdat)
 * 不是分片格式时原样返回
 */
export const splitFragmentedMp4 = (u8: Uint8Array): Uint8Array[] => {
  const boxes = readBoxes(u8)
  const moov = boxes.find(b => b.type === 'moov')
  const frags: Array<[number, number]> = []
  for (let i = 0; i < boxes.length - 1; i++) {
    if (boxes[i].type === 'moof' && boxes[i + 1].type === 'mdat') {
      frags.push([boxes[i].start, boxes[i + 1].start + boxes[i + 1].size])
    }
  }
  if (moov == null || frags.length === 0) {
    return [u8]
  }
  const init = u8.subarray(0, moov.start + moov.size)
  const groups: Uint8Array[] = []
  for (let i = 0; i < frags.length; i += FRAGS_PER_GROUP) {
    const group = frags.slice(i, i + FRAGS_PER_GROUP)
    groups.push(concatBytes([init, ...group.map(([s, e]) => u8.subarray(s, e))]))
  }
  return groups
}

/**
 * 解码为 16k 单声道 int16
 */
export const decodeToPcm16k = async (parts: Uint8Array[], onProgress?: (done: number, total: number) => void): Promise<Int16Array> => {
  const pcms: Int16Array[] = []
  for (let i = 0; i < parts.length; i++) {
    const ctx = new OfflineAudioContext(1, 1, ASR_SAMPLE_RATE)
    // decodeAudioData 会 detach 传入的 buffer，所以复制一份
    const buffer = await ctx.decodeAudioData(parts[i].slice().buffer)
    const channels: Float32Array[] = []
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      channels.push(buffer.getChannelData(c))
    }
    const pcm = new Int16Array(buffer.length)
    for (let s = 0; s < buffer.length; s++) {
      let v = 0
      for (const ch of channels) v += ch[s]
      v /= channels.length
      pcm[s] = Math.max(-1, Math.min(1, v)) * 0x7fff
    }
    pcms.push(pcm)
    onProgress?.(i + 1, parts.length)
  }
  const total = pcms.reduce((sum, p) => sum + p.length, 0)
  const result = new Int16Array(total)
  let offset = 0
  for (const p of pcms) {
    result.set(p, offset)
    offset += p.length
  }
  return result
}

export interface AudioChunk {
  start: number // 采样点
  end: number
}

/**
 * 按静音切段：每段不超过 maxSeconds，在后半段里找最安静的位置切开，并丢弃整段静音的部分
 */
export const splitBySilence = (pcm: Int16Array, maxSeconds: number): AudioChunk[] => {
  const frameCount = Math.ceil(pcm.length / FRAME_SIZE)
  const energy = new Float32Array(frameCount)
  for (let f = 0; f < frameCount; f++) {
    let sum = 0
    const s = f * FRAME_SIZE
    const e = Math.min(s + FRAME_SIZE, pcm.length)
    for (let i = s; i < e; i++) sum += Math.abs(pcm[i])
    energy[f] = sum / Math.max(1, e - s)
  }
  // 以当前帧为中心的滑动平均
  const prefix = new Float64Array(frameCount + 1)
  for (let f = 0; f < frameCount; f++) prefix[f + 1] = prefix[f] + energy[f]
  const half = SMOOTH_FRAMES / 2
  const smooth = new Float32Array(frameCount)
  for (let f = 0; f < frameCount; f++) {
    const s = Math.max(0, f - half)
    const e = Math.min(frameCount, f + half)
    smooth[f] = (prefix[e] - prefix[s]) / (e - s)
  }

  const maxFrames = Math.max(1, Math.round(maxSeconds * 50))
  const minFrames = Math.max(Math.round(maxFrames / 2), Math.min(100, maxFrames))
  const chunks: AudioChunk[] = []
  let startFrame = 0
  while (startFrame < frameCount) {
    let endFrame: number
    if (frameCount - startFrame <= maxFrames) {
      endFrame = frameCount
    } else {
      endFrame = startFrame + maxFrames
      let minEnergy = Infinity
      for (let f = startFrame + minFrames; f < startFrame + maxFrames; f++) {
        if (smooth[f] < minEnergy) {
          minEnergy = smooth[f]
          endFrame = f
        }
      }
    }
    let peak = 0
    for (let f = startFrame; f < endFrame; f++) peak = Math.max(peak, smooth[f])
    if (peak >= SILENT_ENERGY) {
      chunks.push({ start: startFrame * FRAME_SIZE, end: Math.min(endFrame * FRAME_SIZE, pcm.length) })
    }
    startFrame = endFrame
  }
  return chunks
}

export const encodeWav = (pcm: Int16Array): Uint8Array => {
  const dataSize = pcm.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const dv = new DataView(buffer)
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) dv.setUint8(offset + i, str.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  dv.setUint32(4, 36 + dataSize, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  dv.setUint32(16, 16, true)
  dv.setUint16(20, 1, true) // PCM
  dv.setUint16(22, 1, true) // 单声道
  dv.setUint32(24, ASR_SAMPLE_RATE, true)
  dv.setUint32(28, ASR_SAMPLE_RATE * 2, true)
  dv.setUint16(32, 2, true)
  dv.setUint16(34, 16, true)
  writeStr(36, 'data')
  dv.setUint32(40, dataSize, true)
  new Int16Array(buffer, 44).set(pcm)
  return new Uint8Array(buffer)
}

export const bytesToBase64 = (u8: Uint8Array): string => {
  let binary = ''
  const step = 0x8000
  for (let i = 0; i < u8.length; i += step) {
    binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + step)))
  }
  return btoa(binary)
}

export const base64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64)
  const u8 = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i)
  return u8
}
