const MAX_DIMENSION = 1920
const MAX_BYTES = 900 * 1024

const estimatedBytes = (dataUrl: string) => {
  const comma = dataUrl.indexOf(',')
  return comma < 0 ? dataUrl.length : Math.ceil((dataUrl.length - comma - 1) * 0.75)
}

export const compressImageFile = async (file: File): Promise<string> => {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new Error('请选择 PNG、JPG 或 WebP 图片。')
  }
  if (typeof document === 'undefined' || typeof URL === 'undefined') {
    throw new Error('当前环境不支持图片处理。')
  }

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('图片读取失败，请换一张图片。'))
      element.src = objectUrl
    })
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('当前浏览器不支持图片压缩。')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.82, 0.7, 0.58, 0.46]) {
      const dataUrl = canvas.toDataURL('image/webp', quality)
      if (estimatedBytes(dataUrl) <= MAX_BYTES) return dataUrl
    }
    throw new Error('图片压缩后仍然过大，请选择尺寸更小的图片。')
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
