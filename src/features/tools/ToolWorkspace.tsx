import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { MdContentCopy, MdRefresh } from 'react-icons/md'

interface ToolWorkspaceProps {
  toolId: string
}

function ToolPanel({ children }: { children: ReactNode }) {
  return <div className="tool-panel-body">{children}</div>
}

function ToolTextarea({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string
  onChange: (value: string) => void
  placeholder?: string
  value: string
}) {
  return (
    <label className="tool-field tool-field-grow">
      <span>{label}</span>
      <textarea value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  )
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }
  return (
    <button className="tool-copy-button" type="button" onClick={() => void copy()} disabled={!value}>
      <MdContentCopy /> {copied ? '已复制' : '复制'}
    </button>
  )
}

function JsonFormatterTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const convert = (spaces?: number) => {
    try {
      setOutput(JSON.stringify(JSON.parse(input), null, spaces))
      setError('')
    } catch (convertError) {
      setOutput('')
      setError(convertError instanceof Error ? convertError.message : 'JSON 格式不正确')
    }
  }
  return (
    <ToolPanel>
      <div className="tool-split">
        <ToolTextarea label="输入 JSON" value={input} onChange={setInput} placeholder='{"name":"clean-tab"}' />
        <ToolTextarea label="结果" value={output} onChange={setOutput} placeholder="格式化结果会显示在这里" />
      </div>
      {error && <div className="tool-error">{error}</div>}
      <div className="tool-actions-row">
        <button className="primary-button" type="button" onClick={() => convert(2)}>格式化</button>
        <button className="secondary-button" type="button" onClick={() => convert()}>压缩</button>
        <CopyButton value={output} />
      </div>
    </ToolPanel>
  )
}

const bytesToBase64 = (value: string) => {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return window.btoa(binary)
}

const base64ToText = (value: string) => {
  const binary = window.atob(value.trim())
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

function Base64Tool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const run = (mode: 'encode' | 'decode') => {
    try {
      setOutput(mode === 'encode' ? bytesToBase64(input) : base64ToText(input))
      setError('')
    } catch {
      setOutput('')
      setError('输入内容无法完成转换。')
    }
  }
  return (
    <ToolPanel>
      <div className="tool-split">
        <ToolTextarea label="输入" value={input} onChange={setInput} placeholder="输入需要转换的文本" />
        <ToolTextarea label="结果" value={output} onChange={setOutput} />
      </div>
      {error && <div className="tool-error">{error}</div>}
      <div className="tool-actions-row">
        <button className="primary-button" type="button" onClick={() => run('encode')}>编码</button>
        <button className="secondary-button" type="button" onClick={() => run('decode')}>解码</button>
        <CopyButton value={output} />
      </div>
    </ToolPanel>
  )
}

function UrlCodecTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const run = (mode: 'encode' | 'decode') => {
    try {
      setOutput(mode === 'encode' ? encodeURIComponent(input) : decodeURIComponent(input))
      setError('')
    } catch {
      setOutput('')
      setError('URL 内容格式不正确。')
    }
  }
  return (
    <ToolPanel>
      <div className="tool-split">
        <ToolTextarea label="输入" value={input} onChange={setInput} placeholder="输入 URL 或参数" />
        <ToolTextarea label="结果" value={output} onChange={setOutput} />
      </div>
      {error && <div className="tool-error">{error}</div>}
      <div className="tool-actions-row">
        <button className="primary-button" type="button" onClick={() => run('encode')}>编码</button>
        <button className="secondary-button" type="button" onClick={() => run('decode')}>解码</button>
        <CopyButton value={output} />
      </div>
    </ToolPanel>
  )
}

function TextStatisticsTool() {
  const [input, setInput] = useState('')
  const statistics = useMemo(() => ({
    characters: input.length,
    charactersNoSpaces: input.replace(/\s/g, '').length,
    words: input.trim() ? input.trim().split(/\s+/).length : 0,
    lines: input ? input.split(/\r?\n/).length : 0,
  }), [input])
  return (
    <ToolPanel>
      <ToolTextarea label="文本" value={input} onChange={setInput} placeholder="输入或粘贴文本" />
      <div className="tool-stat-grid">
        <div><strong>{statistics.characters}</strong><span>字符</span></div>
        <div><strong>{statistics.charactersNoSpaces}</strong><span>不含空格</span></div>
        <div><strong>{statistics.words}</strong><span>单词</span></div>
        <div><strong>{statistics.lines}</strong><span>行</span></div>
      </div>
    </ToolPanel>
  )
}

const toWords = (value: string) => value.trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean)

function CaseConverterTool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const convert = (mode: string) => {
    const words = toWords(input)
    if (mode === 'upper') setOutput(input.toUpperCase())
    if (mode === 'lower') setOutput(input.toLowerCase())
    if (mode === 'camel') setOutput(words.map((word, index) => index === 0
      ? word.toLowerCase()
      : `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`).join(''))
    if (mode === 'kebab') setOutput(words.map(word => word.toLowerCase()).join('-'))
  }
  return (
    <ToolPanel>
      <div className="tool-split">
        <ToolTextarea label="输入" value={input} onChange={setInput} />
        <ToolTextarea label="结果" value={output} onChange={setOutput} />
      </div>
      <div className="tool-actions-row wrap">
        <button className="primary-button" type="button" onClick={() => convert('upper')}>大写</button>
        <button className="secondary-button" type="button" onClick={() => convert('lower')}>小写</button>
        <button className="secondary-button" type="button" onClick={() => convert('camel')}>camelCase</button>
        <button className="secondary-button" type="button" onClick={() => convert('kebab')}>kebab-case</button>
        <CopyButton value={output} />
      </div>
    </ToolPanel>
  )
}

function UuidTool() {
  const [count, setCount] = useState(5)
  const [output, setOutput] = useState(() => Array.from({ length: 5 }, () => crypto.randomUUID()).join('\n'))
  const generate = () => setOutput(Array.from({ length: Math.min(Math.max(count, 1), 50) }, () => crypto.randomUUID()).join('\n'))
  return (
    <ToolPanel>
      <label className="tool-field tool-inline-field">
        <span>生成数量</span>
        <input type="number" min="1" max="50" value={count} onChange={event => setCount(Number(event.target.value))} />
      </label>
      <ToolTextarea label="UUID" value={output} onChange={setOutput} />
      <div className="tool-actions-row">
        <button className="primary-button" type="button" onClick={generate}><MdRefresh /> 重新生成</button>
        <CopyButton value={output} />
      </div>
    </ToolPanel>
  )
}

function Sha256Tool() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const generate = async () => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    setOutput(Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join(''))
  }
  return (
    <ToolPanel>
      <ToolTextarea label="输入文本" value={input} onChange={setInput} />
      <label className="tool-field">
        <span>SHA-256</span>
        <input value={output} readOnly placeholder="哈希结果" />
      </label>
      <div className="tool-actions-row">
        <button className="primary-button" type="button" onClick={() => void generate()}>生成哈希</button>
        <CopyButton value={output} />
      </div>
    </ToolPanel>
  )
}

function TimestampTool() {
  const [timestamp, setTimestamp] = useState(() => String(Math.floor(Date.now() / 1000)))
  const parsed = useMemo(() => {
    const numeric = Number(timestamp)
    if (!Number.isFinite(numeric)) return null
    const date = new Date(String(Math.trunc(numeric)).length <= 10 ? numeric * 1000 : numeric)
    return Number.isNaN(date.getTime()) ? null : date
  }, [timestamp])
  return (
    <ToolPanel>
      <label className="tool-field">
        <span>Unix 时间戳（秒或毫秒）</span>
        <input value={timestamp} onChange={event => setTimestamp(event.target.value)} />
      </label>
      <div className="tool-result-card">
        <span>本地时间</span>
        <strong>{parsed ? parsed.toLocaleString('zh-CN') : '无效时间戳'}</strong>
        <small>{parsed ? parsed.toISOString() : '请输入有效数字'}</small>
      </div>
      <div className="tool-actions-row">
        <button className="primary-button" type="button" onClick={() => setTimestamp(String(Math.floor(Date.now() / 1000)))}>使用当前时间</button>
        <CopyButton value={timestamp} />
      </div>
    </ToolPanel>
  )
}

function PercentageTool() {
  const [part, setPart] = useState('25')
  const [whole, setWhole] = useState('100')
  const [percent, setPercent] = useState('20')
  const [base, setBase] = useState('500')
  const ratio = Number(whole) === 0 ? null : (Number(part) / Number(whole)) * 100
  const percentageValue = (Number(percent) / 100) * Number(base)
  return (
    <ToolPanel>
      <div className="percentage-grid">
        <section>
          <h3>计算占比</h3>
          <div className="tool-inline-inputs">
            <input type="number" value={part} onChange={event => setPart(event.target.value)} aria-label="部分数值" />
            <span>占</span>
            <input type="number" value={whole} onChange={event => setWhole(event.target.value)} aria-label="总数" />
          </div>
          <strong>{ratio === null || !Number.isFinite(ratio) ? '—' : `${ratio.toFixed(2)}%`}</strong>
        </section>
        <section>
          <h3>计算百分数</h3>
          <div className="tool-inline-inputs">
            <input type="number" value={base} onChange={event => setBase(event.target.value)} aria-label="基础数值" />
            <span>的</span>
            <input type="number" value={percent} onChange={event => setPercent(event.target.value)} aria-label="百分比" />
            <span>%</span>
          </div>
          <strong>{Number.isFinite(percentageValue) ? percentageValue.toFixed(2) : '—'}</strong>
        </section>
      </div>
    </ToolPanel>
  )
}

function RegexTool() {
  const [pattern, setPattern] = useState('\\b\\w+@\\w+\\.\\w+\\b')
  const [flags, setFlags] = useState('gi')
  const [input, setInput] = useState('联系邮箱 hello@example.com')
  const result = useMemo(() => {
    try {
      const normalizedFlags = flags.includes('g') ? flags : `${flags}g`
      const regex = new RegExp(pattern, normalizedFlags)
      return { matches: Array.from(input.matchAll(regex)).slice(0, 100).map(match => match[0]), error: '' }
    } catch (error) {
      return { matches: [], error: error instanceof Error ? error.message : '表达式无效' }
    }
  }, [flags, input, pattern])
  return (
    <ToolPanel>
      <div className="regex-row">
        <label className="tool-field"><span>表达式</span><input value={pattern} onChange={event => setPattern(event.target.value)} /></label>
        <label className="tool-field"><span>标志</span><input value={flags} onChange={event => setFlags(event.target.value)} /></label>
      </div>
      <ToolTextarea label="测试文本" value={input} onChange={setInput} />
      {result.error ? <div className="tool-error">{result.error}</div> : (
        <div className="tool-match-list">
          <span>{result.matches.length} 个匹配</span>
          {result.matches.length === 0 ? <p>没有匹配结果。</p> : result.matches.map((match, index) => <code key={`${match}-${index}`}>{match}</code>)}
        </div>
      )}
    </ToolPanel>
  )
}

const passwordCharacterSets = {
  uppercase: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  lowercase: 'abcdefghijkmnopqrstuvwxyz',
  numbers: '23456789',
  symbols: '!@#$%^&*()-_=+[]{}',
}

const createPassword = (length: number, characterSets: string[]) => {
  const characters = characterSets.join('')
  if (!characters) return ''
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, byte => characters[byte % characters.length]).join('')
}

function PasswordGeneratorTool() {
  const [length, setLength] = useState(20)
  const [options, setOptions] = useState({ uppercase: true, lowercase: true, numbers: true, symbols: true })
  const selectedSets = Object.entries(options)
    .filter(([, enabled]) => enabled)
    .map(([key]) => passwordCharacterSets[key as keyof typeof passwordCharacterSets])
  const [output, setOutput] = useState(() => createPassword(20, Object.values(passwordCharacterSets)))
  const generate = () => setOutput(createPassword(Math.min(Math.max(length, 6), 128), selectedSets))

  return (
    <ToolPanel>
      <div className="tool-form-grid">
        <label className="tool-field">
          <span>密码长度</span>
          <input type="number" min="6" max="128" value={length} onChange={event => setLength(Number(event.target.value))} />
        </label>
        <div className="tool-option-list">
          {Object.entries({ uppercase: '大写字母', lowercase: '小写字母', numbers: '数字', symbols: '符号' }).map(([key, label]) => (
            <label key={key}>
              <input
                type="checkbox"
                checked={options[key as keyof typeof options]}
                onChange={event => setOptions(current => ({ ...current, [key]: event.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
      <label className="tool-field">
        <span>随机密码</span>
        <input className="tool-mono-input" value={output} readOnly />
      </label>
      {!selectedSets.length && <div className="tool-error">请至少选择一种字符类型。</div>}
      <div className="tool-actions-row">
        <button className="primary-button" type="button" onClick={generate} disabled={!selectedSets.length}><MdRefresh /> 重新生成</button>
        <CopyButton value={output} />
      </div>
    </ToolPanel>
  )
}

const decodeJwtPart = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4)
  return JSON.parse(base64ToText(`${normalized}${padding}`)) as Record<string, unknown>
}

function JwtDecoderTool() {
  const [input, setInput] = useState('')
  const result = useMemo(() => {
    if (!input.trim()) return { header: '', payload: '', expiry: '', error: '' }
    try {
      const [headerPart, payloadPart] = input.trim().split('.')
      if (!headerPart || !payloadPart) throw new Error('JWT 应包含至少两个部分')
      const header = decodeJwtPart(headerPart)
      const payload = decodeJwtPart(payloadPart)
      const expiryValue = typeof payload.exp === 'number' ? new Date(payload.exp * 1000) : null
      return {
        header: JSON.stringify(header, null, 2),
        payload: JSON.stringify(payload, null, 2),
        expiry: expiryValue ? `${expiryValue.toLocaleString('zh-CN')} · ${expiryValue.getTime() > Date.now() ? '尚未过期' : '已过期'}` : '未包含 exp 字段',
        error: '',
      }
    } catch (error) {
      return { header: '', payload: '', expiry: '', error: error instanceof Error ? error.message : 'JWT 格式无效' }
    }
  }, [input])

  return (
    <ToolPanel>
      <ToolTextarea label="JWT Token" value={input} onChange={setInput} placeholder="粘贴 eyJ... 格式的令牌" />
      {result.error && <div className="tool-error">{result.error}</div>}
      <div className="tool-split">
        <ToolTextarea label="Header" value={result.header} onChange={() => {}} />
        <ToolTextarea label="Payload" value={result.payload} onChange={() => {}} />
      </div>
      {result.payload && <div className="tool-result-card"><span>过期状态</span><strong>{result.expiry}</strong></div>}
    </ToolPanel>
  )
}

interface RGBColor { red: number; green: number; blue: number }

const clampColor = (value: number) => Math.min(255, Math.max(0, Math.round(value)))
const hslToRgb = (hue: number, saturation: number, lightness: number): RGBColor => {
  const normalizedSaturation = saturation / 100
  const normalizedLightness = lightness / 100
  const chroma = (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation
  const section = ((hue % 360) + 360) % 360 / 60
  const intermediate = chroma * (1 - Math.abs((section % 2) - 1))
  const offset = normalizedLightness - chroma / 2
  const values = section < 1 ? [chroma, intermediate, 0]
    : section < 2 ? [intermediate, chroma, 0]
      : section < 3 ? [0, chroma, intermediate]
        : section < 4 ? [0, intermediate, chroma]
          : section < 5 ? [intermediate, 0, chroma]
            : [chroma, 0, intermediate]
  return { red: clampColor((values[0] + offset) * 255), green: clampColor((values[1] + offset) * 255), blue: clampColor((values[2] + offset) * 255) }
}

const parseColor = (value: string): RGBColor | null => {
  const input = value.trim()
  const hex = input.match(/^#?([\da-f]{3}|[\da-f]{6})$/i)
  if (hex) {
    const normalized = hex[1].length === 3 ? hex[1].split('').map(character => character.repeat(2)).join('') : hex[1]
    return { red: Number.parseInt(normalized.slice(0, 2), 16), green: Number.parseInt(normalized.slice(2, 4), 16), blue: Number.parseInt(normalized.slice(4, 6), 16) }
  }
  const rgb = input.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) return { red: clampColor(Number(rgb[1])), green: clampColor(Number(rgb[2])), blue: clampColor(Number(rgb[3])) }
  const hsl = input.match(/^hsla?\(\s*(-?[\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/i)
  if (hsl) return hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]))
  return null
}

const rgbToHsl = ({ red, green, blue }: RGBColor) => {
  const [normalizedRed, normalizedGreen, normalizedBlue] = [red, green, blue].map(value => value / 255)
  const maximum = Math.max(normalizedRed, normalizedGreen, normalizedBlue)
  const minimum = Math.min(normalizedRed, normalizedGreen, normalizedBlue)
  const lightness = (maximum + minimum) / 2
  const delta = maximum - minimum
  if (!delta) return { hue: 0, saturation: 0, lightness: lightness * 100 }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1))
  const hue = maximum === normalizedRed
    ? 60 * (((normalizedGreen - normalizedBlue) / delta) % 6)
    : maximum === normalizedGreen
      ? 60 * ((normalizedBlue - normalizedRed) / delta + 2)
      : 60 * ((normalizedRed - normalizedGreen) / delta + 4)
  return { hue: hue < 0 ? hue + 360 : hue, saturation: saturation * 100, lightness: lightness * 100 }
}

function ColorConverterTool() {
  const [input, setInput] = useState('#5b67f1')
  const color = useMemo(() => parseColor(input), [input])
  const results = useMemo(() => {
    if (!color) return null
    const hex = `#${[color.red, color.green, color.blue].map(value => value.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
    const hsl = rgbToHsl(color)
    return { hex, rgb: `rgb(${color.red}, ${color.green}, ${color.blue})`, hsl: `hsl(${hsl.hue.toFixed(0)}, ${hsl.saturation.toFixed(1)}%, ${hsl.lightness.toFixed(1)}%)` }
  }, [color])

  return (
    <ToolPanel>
      <label className="tool-field">
        <span>颜色值（HEX、RGB 或 HSL）</span>
        <input value={input} onChange={event => setInput(event.target.value)} placeholder="#5b67f1 或 rgb(91, 103, 241)" />
      </label>
      {!results ? <div className="tool-error">无法识别该颜色格式。</div> : (
        <>
          <div className="color-preview" style={{ background: results.hex }} />
          <div className="tool-result-list">
            {[['HEX', results.hex], ['RGB', results.rgb], ['HSL', results.hsl]].map(([label, value]) => (
              <div className="tool-result-card" key={label}><span>{label}</span><strong>{value}</strong><CopyButton value={value} /></div>
            ))}
          </div>
        </>
      )}
    </ToolPanel>
  )
}

function NumberBaseTool() {
  const [input, setInput] = useState('255')
  const [base, setBase] = useState(10)
  const parsed = useMemo(() => {
    const value = Number.parseInt(input.trim(), base)
    return Number.isNaN(value) ? null : value
  }, [base, input])
  const outputs = parsed === null ? [] : [
    ['二进制', parsed.toString(2)],
    ['八进制', parsed.toString(8)],
    ['十进制', parsed.toString(10)],
    ['十六进制', parsed.toString(16).toUpperCase()],
  ]

  return (
    <ToolPanel>
      <div className="tool-form-grid two-columns">
        <label className="tool-field"><span>输入数值</span><input value={input} onChange={event => setInput(event.target.value)} /></label>
        <label className="tool-field"><span>输入进制</span><select value={base} onChange={event => setBase(Number(event.target.value))}><option value="2">二进制</option><option value="8">八进制</option><option value="10">十进制</option><option value="16">十六进制</option></select></label>
      </div>
      {parsed === null ? <div className="tool-error">输入数值与所选进制不匹配。</div> : (
        <div className="tool-result-list compact">
          {outputs.map(([label, value]) => <div className="tool-result-card" key={label}><span>{label}</span><strong>{value}</strong><CopyButton value={value} /></div>)}
        </div>
      )}
    </ToolPanel>
  )
}

const unitGroups = {
  length: { label: '长度', units: { m: ['米', 1], km: ['千米', 1000], cm: ['厘米', 0.01], mm: ['毫米', 0.001], ft: ['英尺', 0.3048], in: ['英寸', 0.0254], mi: ['英里', 1609.344] } },
  weight: { label: '重量', units: { kg: ['千克', 1], g: ['克', 0.001], mg: ['毫克', 0.000001], lb: ['磅', 0.45359237], oz: ['盎司', 0.028349523125] } },
  temperature: { label: '温度', units: { c: ['摄氏度', 1], f: ['华氏度', 1], k: ['开尔文', 1] } },
} as const

type UnitGroupId = keyof typeof unitGroups

const convertTemperature = (value: number, from: string, to: string) => {
  const celsius = from === 'c' ? value : from === 'f' ? (value - 32) * 5 / 9 : value - 273.15
  return to === 'c' ? celsius : to === 'f' ? celsius * 9 / 5 + 32 : celsius + 273.15
}

function UnitConverterTool() {
  const [group, setGroup] = useState<UnitGroupId>('length')
  const [fromUnit, setFromUnit] = useState('m')
  const [toUnit, setToUnit] = useState('km')
  const [value, setValue] = useState('1000')
  const units = unitGroups[group].units as Record<string, readonly [string, number]>
  const numericValue = Number(value)
  const result = Number.isFinite(numericValue)
    ? group === 'temperature'
      ? convertTemperature(numericValue, fromUnit, toUnit)
      : numericValue * units[fromUnit][1] / units[toUnit][1]
    : null
  const changeGroup = (nextGroup: UnitGroupId) => {
    const unitIds = Object.keys(unitGroups[nextGroup].units)
    setGroup(nextGroup)
    setFromUnit(unitIds[0])
    setToUnit(unitIds[1] || unitIds[0])
  }

  return (
    <ToolPanel>
      <div className="tool-form-grid three-columns">
        <label className="tool-field"><span>类型</span><select value={group} onChange={event => changeGroup(event.target.value as UnitGroupId)}>{Object.entries(unitGroups).map(([id, item]) => <option value={id} key={id}>{item.label}</option>)}</select></label>
        <label className="tool-field"><span>从</span><select value={fromUnit} onChange={event => setFromUnit(event.target.value)}>{Object.entries(units).map(([id, item]) => <option value={id} key={id}>{item[0]}</option>)}</select></label>
        <label className="tool-field"><span>到</span><select value={toUnit} onChange={event => setToUnit(event.target.value)}>{Object.entries(units).map(([id, item]) => <option value={id} key={id}>{item[0]}</option>)}</select></label>
      </div>
      <label className="tool-field"><span>数值</span><input type="number" value={value} onChange={event => setValue(event.target.value)} /></label>
      <div className="tool-result-card"><span>换算结果</span><strong>{result === null ? '—' : `${Number(result.toPrecision(12))} ${units[toUnit][0]}`}</strong></div>
    </ToolPanel>
  )
}

const parseCsv = (input: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
    if (character === '"' && quoted && input[index + 1] === '"') { cell += '"'; index += 1 } else if (character === '"') quoted = !quoted
    else if (character === ',' && !quoted) { row.push(cell); cell = '' }
    else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && input[index + 1] === '\n') index += 1
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += character
  }
  row.push(cell)
  if (row.some(value => value.length) || rows.length === 0) rows.push(row)
  const [headers, ...values] = rows
  return values.filter(item => item.some(value => value.length)).map(item => Object.fromEntries(headers.map((header, index) => [header.trim(), item[index] ?? ''])))
}

const escapeCsv = (value: unknown) => {
  const text = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function CsvJsonTool() {
  const [input, setInput] = useState('name,age\nAlice,28\nBob,31')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const convert = (mode: 'csv-to-json' | 'json-to-csv') => {
    try {
      if (mode === 'csv-to-json') setOutput(JSON.stringify(parseCsv(input), null, 2))
      else {
        const data = JSON.parse(input) as Array<Record<string, unknown>>
        if (!Array.isArray(data)) throw new Error('JSON 必须是对象数组')
        const headers = Array.from(new Set(data.flatMap(item => Object.keys(item))))
        setOutput([headers.join(','), ...data.map(item => headers.map(header => escapeCsv(item[header])).join(','))].join('\n'))
      }
      setError('')
    } catch (convertError) {
      setOutput('')
      setError(convertError instanceof Error ? convertError.message : '转换失败')
    }
  }

  return (
    <ToolPanel>
      <div className="tool-split"><ToolTextarea label="输入" value={input} onChange={setInput} /><ToolTextarea label="结果" value={output} onChange={setOutput} /></div>
      {error && <div className="tool-error">{error}</div>}
      <div className="tool-actions-row wrap"><button className="primary-button" type="button" onClick={() => convert('csv-to-json')}>CSV 转 JSON</button><button className="secondary-button" type="button" onClick={() => convert('json-to-csv')}>JSON 转 CSV</button><CopyButton value={output} /></div>
    </ToolPanel>
  )
}

const encodeHtmlEntities = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character)
const decodeHtmlEntities = (value: string) => new DOMParser().parseFromString(value, 'text/html').documentElement.textContent || ''

function HtmlEntitiesTool() {
  const [input, setInput] = useState('Tom & Jerry <strong>hello</strong>')
  const [output, setOutput] = useState('')
  return (
    <ToolPanel>
      <div className="tool-split"><ToolTextarea label="输入" value={input} onChange={setInput} /><ToolTextarea label="结果" value={output} onChange={setOutput} /></div>
      <div className="tool-actions-row"><button className="primary-button" type="button" onClick={() => setOutput(encodeHtmlEntities(input))}>编码</button><button className="secondary-button" type="button" onClick={() => setOutput(decodeHtmlEntities(input))}>解码</button><CopyButton value={output} /></div>
    </ToolPanel>
  )
}

function UrlParserTool() {
  const [input, setInput] = useState('https://example.com/docs?page=2&sort=new#intro')
  const result = useMemo(() => {
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`)
      return { error: '', value: JSON.stringify({ protocol: url.protocol.replace(':', ''), hostname: url.hostname, port: url.port || '默认', pathname: url.pathname, hash: url.hash || '', query: Object.fromEntries(url.searchParams.entries()), origin: url.origin }, null, 2) }
    } catch {
      return { error: '请输入有效的 URL。', value: '' }
    }
  }, [input])
  return (
    <ToolPanel>
      <label className="tool-field"><span>URL</span><input value={input} onChange={event => setInput(event.target.value)} /></label>
      {result.error && <div className="tool-error">{result.error}</div>}
      <ToolTextarea label="解析结果" value={result.value} onChange={() => {}} />
      <CopyButton value={result.value} />
    </ToolPanel>
  )
}

function DeviceInformationTool() {
  const information = [
    ['浏览器标识', navigator.userAgent],
    ['系统平台', navigator.platform || '未知'],
    ['首选语言', navigator.language],
    ['逻辑处理器', String(navigator.hardwareConcurrency || '未知')],
    ['屏幕尺寸', `${window.screen.width} × ${window.screen.height}`],
    ['像素比例', String(window.devicePixelRatio)],
    ['色彩深度', `${window.screen.colorDepth} bit`],
    ['时区', Intl.DateTimeFormat().resolvedOptions().timeZone],
    ['网络状态', navigator.onLine ? '在线' : '离线'],
  ]
  return <ToolPanel><div className="device-info-grid">{information.map(([label, value]) => <div className="tool-result-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></ToolPanel>
}

interface DiffLine { type: 'same' | 'added' | 'removed'; value: string }

const createLineDiff = (left: string, right: string): DiffLine[] => {
  const leftLines = left.split('\n').slice(0, 300)
  const rightLines = right.split('\n').slice(0, 300)
  const matrix = Array.from({ length: leftLines.length + 1 }, () => Array(rightLines.length + 1).fill(0) as number[])
  for (let leftIndex = 1; leftIndex <= leftLines.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= rightLines.length; rightIndex += 1) {
      matrix[leftIndex][rightIndex] = leftLines[leftIndex - 1] === rightLines[rightIndex - 1]
        ? matrix[leftIndex - 1][rightIndex - 1] + 1
        : Math.max(matrix[leftIndex - 1][rightIndex], matrix[leftIndex][rightIndex - 1])
    }
  }
  const result: DiffLine[] = []
  let leftIndex = leftLines.length
  let rightIndex = rightLines.length
  while (leftIndex || rightIndex) {
    if (leftIndex && rightIndex && leftLines[leftIndex - 1] === rightLines[rightIndex - 1]) {
      result.push({ type: 'same', value: leftLines[leftIndex - 1] }); leftIndex -= 1; rightIndex -= 1
    } else if (rightIndex && (!leftIndex || matrix[leftIndex][rightIndex - 1] >= matrix[leftIndex - 1][rightIndex])) {
      result.push({ type: 'added', value: rightLines[rightIndex - 1] }); rightIndex -= 1
    } else {
      result.push({ type: 'removed', value: leftLines[leftIndex - 1] }); leftIndex -= 1
    }
  }
  return result.reverse()
}

function TextDiffTool() {
  const [left, setLeft] = useState('第一行\n需要删除的内容\n相同内容')
  const [right, setRight] = useState('第一行\n新增的内容\n相同内容')
  const diff = useMemo(() => createLineDiff(left, right), [left, right])
  return (
    <ToolPanel>
      <div className="tool-split"><ToolTextarea label="原文本" value={left} onChange={setLeft} /><ToolTextarea label="新文本" value={right} onChange={setRight} /></div>
      <div className="text-diff-result">{diff.map((line, index) => <div className={`diff-${line.type}`} key={`${line.type}-${index}`}><span>{line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}</span><code>{line.value || ' '}</code></div>)}</div>
    </ToolPanel>
  )
}

export function ToolWorkspace({ toolId }: ToolWorkspaceProps) {
  if (toolId === 'json-formatter') return <JsonFormatterTool />
  if (toolId === 'base64') return <Base64Tool />
  if (toolId === 'url-codec') return <UrlCodecTool />
  if (toolId === 'text-statistics') return <TextStatisticsTool />
  if (toolId === 'case-converter') return <CaseConverterTool />
  if (toolId === 'uuid') return <UuidTool />
  if (toolId === 'sha256') return <Sha256Tool />
  if (toolId === 'timestamp') return <TimestampTool />
  if (toolId === 'percentage') return <PercentageTool />
  if (toolId === 'regex-tester') return <RegexTool />
  if (toolId === 'password-generator') return <PasswordGeneratorTool />
  if (toolId === 'jwt-decoder') return <JwtDecoderTool />
  if (toolId === 'color-converter') return <ColorConverterTool />
  if (toolId === 'number-base') return <NumberBaseTool />
  if (toolId === 'unit-converter') return <UnitConverterTool />
  if (toolId === 'csv-json') return <CsvJsonTool />
  if (toolId === 'html-entities') return <HtmlEntitiesTool />
  if (toolId === 'url-parser') return <UrlParserTool />
  if (toolId === 'device-information') return <DeviceInformationTool />
  if (toolId === 'text-diff') return <TextDiffTool />
  return null
}
