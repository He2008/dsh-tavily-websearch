/**
 * Host half of the Tavily web search bundle. It registers a search provider on
 * `ctx.web`, so the shipped `web_search` tool is served by Tavily without any
 * change to the tool schema, result formatting, or settings page.
 *
 * Authentication comes from one or more Tavily API keys. Keys are resolved per
 * search from the credential store and the environment; searches rotate across
 * them and skip a key that the service rejected or rate-limited. With no key
 * configured the provider uses Tavily's keyless access mode.
 */

export const name = 'tavily-websearch'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Registry id that `web.searchProvider` selects. */
const PROVIDER_ID = 'tavily'

/** Tavily's public API origin; `/search` is appended. */
const DEFAULT_BASE_URL = 'https://api.tavily.com'

/** First credential reference, and the default environment variable name. */
const DEFAULT_API_KEY_ENV = 'TAVILY_API_KEY'

/** Number of numbered credential references the settings card manages. */
const KEY_SLOT_COUNT = 8

/** Fallback result cap when the tool does not pass `maxResults`. */
const DEFAULT_MAX_RESULTS = 10

/** Tavily's own upper bound for `max_results`. */
const TAVILY_MAX_RESULTS = 20

/** Accepted `search_depth` values. */
const SEARCH_DEPTHS = new Set(['advanced', 'basic', 'fast', 'ultra-fast'])

/** Credential references are environment-variable names. */
const REFERENCE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/u

/** Picker description in every language the shipped web settings page resolves. */
const DESCRIPTION = {
  en: 'Searches the web through Tavily and returns ranked titles, URLs, and content snippets. Rotates across the configured API keys and uses Tavily keyless mode when none is configured.',
  zh: '通过 Tavily 搜索网页，返回排序后的标题、URL 与内容摘要。在配置的多个 API Key 之间轮换；未配置时使用 Tavily 免密钥模式。',
  ja: 'Tavily 経由でウェブを検索し、順位付けされたタイトル、URL、内容の抜粋を返します。設定した API キー間でローテーションし、キー未設定時は Tavily のキーレスモードを使用します。',
  es: 'Busca en la web mediante Tavily y devuelve títulos, URL y fragmentos de contenido ordenados. Rota entre las claves de API configuradas y usa el modo sin clave de Tavily cuando no hay ninguna.',
  fr: 'Recherche sur le web via Tavily et renvoie des titres, URL et extraits de contenu classés. Alterne entre les clés API configurées et utilise le mode sans clé de Tavily lorsqu’aucune ne l’est.',
  de: 'Durchsucht das Web über Tavily und liefert sortierte Titel, URLs und Inhaltsauszüge. Wechselt zwischen den konfigurierten API-Schlüsseln und nutzt den schlüssellosen Tavily-Modus, wenn keiner gesetzt ist.',
  ru: 'Ищет в интернете через Tavily и возвращает упорядоченные заголовки, URL и фрагменты текста. Чередует настроенные ключи API и использует режим Tavily без ключа, когда ключей нет.',
  pt: 'Pesquisa na web via Tavily e retorna títulos, URLs e trechos de conteúdo ordenados. Alterna entre as chaves de API configuradas e usa o modo sem chave do Tavily quando nenhuma existe.',
}

/**
 * Build a structured error the web seam and `web_search` understand.
 * @param {string} message - actionable failure description.
 * @param {string} code - open error code from the web vocabulary.
 * @param {{ status?: number, tavilyCode?: string }} [details] - HTTP status and Tavily's own error code, used for key failover.
 * @returns {Error} an `Error` carrying the web `code` and failover details.
 */
function webError(message, code, details = {}) {
  const error = new Error(message)
  error.name = 'WebError'
  error.code = code
  if (details.status !== undefined) error.status = details.status
  if (details.tavilyCode !== undefined) error.tavilyCode = details.tavilyCode
  return error
}

/**
 * Whether one failed attempt means "try the next key" rather than "stop":
 * rejected credentials and exhausted rate or plan limits.
 * @param {unknown} error - the thrown value.
 * @returns {boolean} true for 401, 403, 429, 432, and 433 responses.
 */
function isKeyFailure(error) {
  return typeof error === 'object' && error !== null && typeof error.status === 'number'
    && [401, 403, 429, 432, 433].includes(error.status)
}

/**
 * Resolve and validate the row configuration once, at plugin load, so a bad
 * bundle patch fails at startup instead of on the first search.
 * @param {unknown} config - the loader's row config.
 * @returns {object} the fully defaulted provider options.
 */
function resolveOptions(config) {
  const source = config ?? {}
  if (typeof source !== 'object' || Array.isArray(source)) {
    throw new Error('tavily-websearch: config must be an object')
  }

  const rawBaseURL = source.baseURL ?? process.env.TAVILY_BASE_URL ?? DEFAULT_BASE_URL
  if (typeof rawBaseURL !== 'string' || rawBaseURL.length === 0) {
    throw new Error('tavily-websearch: baseURL must be a non-empty string')
  }
  let parsed
  try {
    parsed = new URL(rawBaseURL)
  } catch {
    throw new Error(`tavily-websearch: baseURL is not a valid URL: ${rawBaseURL}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`tavily-websearch: baseURL must use http or https, got ${parsed.protocol}`)
  }
  const endpoint = parsed.pathname.endsWith('/search')
    ? parsed.toString()
    : new URL('search', `${parsed.origin}${parsed.pathname.replace(/\/+$/u, '')}/`).toString()

  const apiKey = typeof source.apiKey === 'string' && source.apiKey.trim().length > 0
    ? source.apiKey.trim()
    : undefined
  const rawApiKeys = source.apiKeys ?? []
  if (!Array.isArray(rawApiKeys) || rawApiKeys.some(key => typeof key !== 'string' || key.trim().length === 0)) {
    throw new Error('tavily-websearch: apiKeys must be an array of non-empty strings')
  }
  const apiKeys = rawApiKeys.map(key => key.trim())

  const apiKeyEnv = typeof source.apiKeyEnv === 'string' && source.apiKeyEnv.length > 0
    ? source.apiKeyEnv
    : DEFAULT_API_KEY_ENV
  if (!REFERENCE_PATTERN.test(apiKeyEnv)) {
    throw new Error(`tavily-websearch: apiKeyEnv must be an environment-variable name, got "${apiKeyEnv}"`)
  }

  const searchDepth = source.searchDepth ?? 'basic'
  if (!SEARCH_DEPTHS.has(searchDepth)) {
    throw new Error(`tavily-websearch: searchDepth must be one of ${[...SEARCH_DEPTHS].join(', ')}`)
  }

  const maxResults = source.maxResults ?? DEFAULT_MAX_RESULTS
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > TAVILY_MAX_RESULTS) {
    throw new Error(`tavily-websearch: maxResults must be an integer from 1 to ${TAVILY_MAX_RESULTS}`)
  }

  const keylessFallback = source.keylessFallback ?? true
  if (typeof keylessFallback !== 'boolean') {
    throw new Error('tavily-websearch: keylessFallback must be a boolean')
  }

  const keyRefs = Array.from(
    { length: KEY_SLOT_COUNT },
    (_, index) => index === 0 ? apiKeyEnv : `${apiKeyEnv}_${index + 1}`,
  )

  return {
    endpoint,
    apiKey,
    apiKeys,
    apiKeyEnv,
    keyRefs,
    searchDepth,
    includeAnswer: source.includeAnswer === true,
    maxResults,
    keylessFallback,
  }
}

/** Whether a thrown value is the abort path rather than a transport failure. */
function isAbort(error) {
  return error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
}

/**
 * Convert Tavily's `published_date` into the seam's ISO-8601 contract.
 * @param {unknown} value - provider-supplied date string.
 * @returns {string | undefined} an ISO timestamp, or `undefined` when absent or unparseable.
 */
function toIsoDate(value) {
  if (typeof value !== 'string' || value.length === 0) return undefined
  const time = Date.parse(value)
  return Number.isNaN(time) ? undefined : new Date(time).toISOString()
}

/**
 * Extract the most specific message Tavily supplies for a failed request.
 * @param {number} status - HTTP status code.
 * @param {string} text - raw response body.
 * @param {unknown} payload - parsed body when it was JSON.
 * @param {string | null} retryAfter - the `Retry-After` header, when present.
 * @returns {string} the failure message, including a recovery hint for auth and quota codes.
 */
function failureMessage(status, text, payload, retryAfter) {
  const detail = typeof payload === 'object' && payload !== null && typeof payload.detail === 'object' && payload.detail !== null
    ? payload.detail.error
    : undefined
  const detailMessage = typeof detail === 'string'
    ? detail
    : typeof detail === 'object' && detail !== null && typeof detail.message === 'string'
      ? detail.message
      : undefined
  const wait = status === 429 && retryAfter !== null && /^\d+$/u.test(retryAfter) ? ` Retry after ${retryAfter}s.` : ''
  const hint = status === 401 || status === 403
    ? ' Check this key in the Tavily settings card, or remove it to use keyless mode.'
    : status === 429 || status === 432 || status === 433
      ? ` Tavily rate limit or plan quota reached; other configured keys are tried next.${wait}`
      : ''
  const body = detailMessage !== undefined && detailMessage.length > 0
    ? detailMessage
    : text.trim().slice(0, 500)
  return `Tavily search failed (HTTP ${status})${body.length > 0 ? `: ${body}` : ''}.${hint}`
}

/**
 * Resolve every configured key for one search. Literal configuration keys come
 * first, then the numbered credential references. Resolution is per search, so
 * a key saved from the settings card reaches the next search without a restart.
 * @param {object} ctx - plugin context; the optional credentials service supplies stored and ambient values.
 * @param {object} options - resolved provider options.
 * @returns {Promise<string[]>} distinct non-empty keys in preference order.
 */
async function resolveKeys(ctx, options) {
  const keys = []
  const add = (value) => {
    if (typeof value !== 'string') return
    const trimmed = value.trim()
    if (trimmed.length > 0 && !keys.includes(trimmed)) keys.push(trimmed)
  }
  add(options.apiKey)
  for (const key of options.apiKeys) add(key)

  const credentials = typeof ctx.get === 'function' ? ctx.get('credentials') : undefined
  const resolved = await Promise.all(options.keyRefs.map(async (reference) => {
    if (credentials !== undefined) {
      const credential = await credentials.resolve(reference)
      if (credential !== undefined) return credential.value
    }
    return process.env[reference]
  }))
  for (const value of resolved) add(value)
  return keys
}

/**
 * Run one search request with an explicit key, or anonymously when omitted.
 * @param {object} options - resolved provider options.
 * @param {{ query: string, maxResults?: number }} request - the seam's search request.
 * @param {AbortSignal | undefined} signal - cancellation forwarded from the tool call.
 * @param {string | undefined} apiKey - the key to authenticate with; omitted requests Tavily keyless mode.
 * @returns {Promise<{ content?: string, sources: Array<object>, truncated: boolean }>} normalized search outcome.
 */
async function requestTavily(options, request, signal, apiKey) {
  const query = typeof request.query === 'string' ? request.query.trim() : ''
  if (query.length === 0) {
    throw webError('Tavily search requires a non-empty query', 'WEB_PROVIDER_ERROR')
  }

  const maxResults = Math.min(Math.max(request.maxResults ?? options.maxResults, 1), TAVILY_MAX_RESULTS)
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
  }
  if (apiKey !== undefined) headers.authorization = `Bearer ${apiKey}`
  else headers['x-tavily-access-mode'] = 'keyless'

  let response
  let text
  try {
    response = await fetch(options.endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query,
        max_results: maxResults,
        search_depth: options.searchDepth,
        include_answer: options.includeAnswer,
        include_published_date: true,
      }),
      signal,
    })
    text = await response.text()
  } catch (error) {
    if (isAbort(error)) throw webError('Tavily search was cancelled', 'WEB_ABORTED')
    const cause = error instanceof Error ? error.message : String(error)
    throw webError(`Tavily search request to ${options.endpoint} failed: ${cause}`, 'WEB_PROVIDER_ERROR')
  }

  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    payload = undefined
  }

  if (!response.ok) {
    const tavilyCode = typeof payload === 'object' && payload !== null
      && typeof payload.detail === 'object' && payload.detail !== null
      && typeof payload.detail.error === 'object' && payload.detail.error !== null
      && typeof payload.detail.error.code === 'string'
      ? payload.detail.error.code
      : undefined
    throw webError(
      failureMessage(response.status, text, payload, response.headers.get('retry-after')),
      'WEB_PROVIDER_ERROR',
      { status: response.status, ...tavilyCode === undefined ? {} : { tavilyCode } },
    )
  }
  if (typeof payload !== 'object' || payload === null || !Array.isArray(payload.results)) {
    throw webError('Tavily search returned a response without a results array', 'WEB_PROVIDER_ERROR')
  }

  const seen = new Set()
  const sources = []
  for (const item of payload.results) {
    if (typeof item !== 'object' || item === null) continue
    if (typeof item.url !== 'string' || item.url.length === 0 || seen.has(item.url)) continue
    seen.add(item.url)
    const source = { url: item.url }
    if (typeof item.title === 'string' && item.title.length > 0) source.title = item.title
    if (typeof item.content === 'string' && item.content.trim().length > 0) source.summary = item.content
    const publishedAt = toIsoDate(item.published_date)
    if (publishedAt !== undefined) source.publishedAt = publishedAt
    sources.push(source)
  }

  const content = typeof payload.answer === 'string' && payload.answer.trim().length > 0
    ? payload.answer
    : undefined
  return {
    ...content === undefined ? {} : { content },
    sources,
    truncated: false,
  }
}

/** Rotate a key list so the next search starts after the previous winner. */
function rotated(keys, cursor) {
  if (keys.length === 0) return keys
  const start = cursor % keys.length
  return [...keys.slice(start), ...keys.slice(0, start)]
}

/** Combine every attempt's failure into one actionable error without repeating identical messages. */
function everyKeyFailed(failures) {
  const messages = [...new Set(failures.map(failure => failure.message))]
  const shown = messages.slice(0, 3).join(' | ')
  const suffix = messages.length > 3 ? ` | … (${messages.length - 3} more)` : ''
  return webError(
    `Tavily search failed with every configured key: ${shown}${suffix}`,
    'WEB_PROVIDER_ERROR',
  )
}

/**
 * Run one search across the configured keys, then the keyless fallback.
 * @param {object} ctx - plugin context supplying the credentials service.
 * @param {object} options - resolved provider options.
 * @param {{ cursor: number, dead: Set<string> }} ring - rotation cursor and keys rejected with 401/403.
 * @param {{ query: string, maxResults?: number }} request - the seam's search request.
 * @param {AbortSignal | undefined} signal - cancellation forwarded to the tool call.
 * @param {(message: string) => void} warn - deployment log for a keyless fallback after key failures.
 * @returns {Promise<{ content?: string, sources: Array<object>, truncated: boolean }>} normalized search outcome.
 */
async function searchTavily(ctx, options, ring, request, signal, warn) {
  const keys = await resolveKeys(ctx, options)
  const usable = keys.filter(key => !ring.dead.has(key))
  const failures = []

  for (const [position, key] of rotated(usable, ring.cursor).entries()) {
    if (signal?.aborted === true) throw webError('Tavily search was cancelled', 'WEB_ABORTED')
    try {
      const result = await requestTavily(options, request, signal, key)
      ring.cursor = usable.length === 0 ? 0 : (ring.cursor + position + 1) % usable.length
      return result
    } catch (error) {
      if (error.code === 'WEB_ABORTED') throw error
      if (!isKeyFailure(error)) throw error
      failures.push(error)
      if (error.status === 401 || error.status === 403) ring.dead.add(key)
    }
  }

  if (options.keylessFallback) {
    try {
      const result = await requestTavily(options, request, signal, undefined)
      if (failures.length > 0) warn('tavily-websearch: every configured key failed; this search used keyless mode')
      return result
    } catch (error) {
      if (error.code === 'WEB_ABORTED') throw error
      failures.push(error)
    }
  }

  if (failures.length === 0) {
    throw webError(
      keys.length > 0
        ? 'every configured Tavily API key was rejected earlier; add a valid key, or enable keyless fallback'
        : 'no Tavily API key is configured and keyless fallback is disabled',
      'WEB_PROVIDER_ERROR',
    )
  }
  throw everyKeyFailed(failures)
}

/**
 * Register the Tavily search provider with `ctx.web`.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context providing the web service.
 * @param {unknown} config - the loader's row config.
 */
export function apply(ctx, config) {
  const options = resolveOptions(config)
  const ring = { cursor: 0, dead: new Set() }
  const warn = (message) => { try { ctx.logger?.warn?.(message) } catch (_loggingFailure) { /* logging must not fail a search */ } }
  ctx.web.registerSearchProvider({
    id: PROVIDER_ID,
    title: 'Tavily',
    description: DESCRIPTION,
    // Keyless mode is available while it is enabled, so the provider stays usable.
    available: () => true,
    search: (request, signal) => searchTavily(ctx, options, ring, request, signal, warn),
  })
}
