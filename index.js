/**
 * Host half of the Tavily web search bundle. It registers a search provider on
 * `ctx.web`, so the shipped `web_search` tool is served by Tavily without any
 * change to the tool schema, result formatting, or settings page.
 *
 * Requests use Tavily's keyless access mode when no API key is configured, so
 * the provider works immediately and switches to account limits once
 * `TAVILY_API_KEY` (or the configured key) is present.
 */

export const name = 'tavily-websearch'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Registry id that `web.searchProvider` selects. */
const PROVIDER_ID = 'tavily'

/** Tavily's public API origin; `/search` is appended. */
const DEFAULT_BASE_URL = 'https://api.tavily.com'

/** Environment variable naming the Tavily API key. */
const DEFAULT_API_KEY_ENV = 'TAVILY_API_KEY'

/** Fallback result cap when the tool does not pass `maxResults`. */
const DEFAULT_MAX_RESULTS = 10

/** Tavily's own upper bound for `max_results`. */
const TAVILY_MAX_RESULTS = 20

/** Accepted `search_depth` values. */
const SEARCH_DEPTHS = new Set(['advanced', 'basic', 'fast', 'ultra-fast'])

/** Picker description in every language the shipped web settings page resolves. */
const DESCRIPTION = {
  en: 'Searches the web through Tavily and returns ranked titles, URLs, and content snippets. Uses Tavily keyless mode when no key is configured; set TAVILY_API_KEY to use account limits and billing.',
  zh: '通过 Tavily 搜索网页，返回排序后的标题、URL 与内容摘要。未配置密钥时使用 Tavily 免密钥模式；设置 TAVILY_API_KEY 后按账户额度与计费使用。',
  ja: 'Tavily 経由でウェブを検索し、順位付けされたタイトル、URL、内容の抜粋を返します。キー未設定時は Tavily のキーレスモードを使用し、TAVILY_API_KEY を設定するとアカウントの上限と課金が適用されます。',
  es: 'Busca en la web mediante Tavily y devuelve títulos, URL y fragmentos de contenido ordenados. Sin clave usa el modo sin clave de Tavily; con TAVILY_API_KEY usa los límites y la facturación de la cuenta.',
  fr: 'Recherche sur le web via Tavily et renvoie des titres, URL et extraits de contenu classés. Sans clé, utilise le mode sans clé de Tavily ; avec TAVILY_API_KEY, applique les limites et la facturation du compte.',
  de: 'Durchsucht das Web über Tavily und liefert sortierte Titel, URLs und Inhaltsauszüge. Ohne Schlüssel wird der schlüssellose Tavily-Modus verwendet; mit TAVILY_API_KEY gelten Kontolimits und Abrechnung.',
  ru: 'Ищет в интернете через Tavily и возвращает упорядоченные заголовки, URL и фрагменты текста. Без ключа используется режим Tavily без ключа; с TAVILY_API_KEY действуют лимиты и оплата аккаунта.',
  pt: 'Pesquisa na web via Tavily e retorna títulos, URLs e trechos de conteúdo ordenados. Sem chave, usa o modo sem chave do Tavily; com TAVILY_API_KEY, aplica os limites e a cobrança da conta.',
}

/**
 * Build a structured error the web seam and `web_search` understand.
 * @param {string} message - actionable failure description.
 * @param {string} code - open error code from the web vocabulary.
 * @returns {Error} an `Error` carrying the web `code` field.
 */
function webError(message, code) {
  const error = new Error(message)
  error.name = 'WebError'
  error.code = code
  return error
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
  const apiKeyEnv = typeof source.apiKeyEnv === 'string' && source.apiKeyEnv.length > 0
    ? source.apiKeyEnv
    : DEFAULT_API_KEY_ENV

  const searchDepth = source.searchDepth ?? 'basic'
  if (!SEARCH_DEPTHS.has(searchDepth)) {
    throw new Error(`tavily-websearch: searchDepth must be one of ${[...SEARCH_DEPTHS].join(', ')}`)
  }

  const maxResults = source.maxResults ?? DEFAULT_MAX_RESULTS
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > TAVILY_MAX_RESULTS) {
    throw new Error(`tavily-websearch: maxResults must be an integer from 1 to ${TAVILY_MAX_RESULTS}`)
  }

  return {
    endpoint,
    apiKey,
    apiKeyEnv,
    searchDepth,
    includeAnswer: source.includeAnswer === true,
    maxResults,
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
    ? ' Check TAVILY_API_KEY, or unset it to use Tavily keyless mode.'
    : status === 429 || status === 432 || status === 433
      ? ` Tavily rate limit or plan quota reached; wait, configure TAVILY_API_KEY for account limits, or upgrade the plan.${wait}`
      : ''
  const body = detailMessage !== undefined && detailMessage.length > 0
    ? detailMessage
    : text.trim().slice(0, 500)
  return `Tavily search failed (HTTP ${status})${body.length > 0 ? `: ${body}` : ''}.${hint}`
}

/**
 * Run one Tavily search and normalize the response to the seam's result.
 * @param {object} options - resolved provider options.
 * @param {{ query: string, maxResults?: number }} request - the seam's search request.
 * @param {AbortSignal | undefined} signal - cancellation forwarded from the tool call.
 * @returns {Promise<{ content?: string, sources: Array<object>, truncated: boolean }>} normalized search outcome.
 */
async function searchTavily(options, request, signal) {
  const query = typeof request.query === 'string' ? request.query.trim() : ''
  if (query.length === 0) {
    throw webError('Tavily search requires a non-empty query', 'WEB_PROVIDER_ERROR')
  }

  const maxResults = Math.min(Math.max(request.maxResults ?? options.maxResults, 1), TAVILY_MAX_RESULTS)
  const envApiKey = (process.env[options.apiKeyEnv] ?? '').trim()
  const apiKey = options.apiKey ?? (envApiKey.length > 0 ? envApiKey : undefined)
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
    throw webError(failureMessage(response.status, text, payload, response.headers.get('retry-after')), 'WEB_PROVIDER_ERROR')
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

/**
 * Register the Tavily search provider with `ctx.web`.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context providing the web service.
 * @param {unknown} config - the loader's row config.
 */
export function apply(ctx, config) {
  const options = resolveOptions(config)
  ctx.web.registerSearchProvider({
    id: PROVIDER_ID,
    title: 'Tavily',
    description: DESCRIPTION,
    // Keyless mode is always available, so the provider is always usable.
    available: () => true,
    search: (request, signal) => searchTavily(options, request, signal),
  })
}
