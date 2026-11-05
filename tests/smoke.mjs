/**
 * Smoke checks for the Tavily bundle. The default run stubs `fetch` and the
 * credentials service, so request construction, key rotation, failover, and
 * response mapping are verified offline. `--live` performs one real keyless
 * search against api.tavily.com.
 */
import assert from 'node:assert/strict'

import { apply } from '../index.js'

/** Register the provider against a stub context and return it with its warnings. */
function registerProvider(config = {}, environment = {}) {
  let provider
  const warnings = []
  const routes = []
  const listeners = new Map()
  const webServer = {
    register(route) {
      routes.push(route)
      return () => { routes.splice(routes.indexOf(route), 1) }
    },
  }
  const ctx = {
    get: (name) => name === 'credentials'
      ? environment.credentials
      : name === 'webServer' ? webServer : undefined,
    on: (event, listener) => {
      listeners.set(event, listener)
      return () => { listeners.delete(event) }
    },
    effect: (callback) => {
      const dispose = callback()
      return () => { if (typeof dispose === 'function') dispose() }
    },
    logger: { warn: (message) => { warnings.push(message) } },
    web: {
      registerSearchProvider(candidate) {
        provider = candidate
      },
    },
  }
  apply(ctx, config)
  assert.ok(provider, 'apply must register a search provider')
  return { provider, warnings, routes, listeners }
}

/** Credential service stub returning the given values by reference. */
function credentialsOf(values) {
  return {
    resolve: async (reference) => values[reference] === undefined
      ? undefined
      : { value: values[reference], source: 'file' },
  }
}

/** Replace global fetch for one test and restore it afterwards. */
async function withStubFetch(stub, run) {
  const original = globalThis.fetch
  globalThis.fetch = stub
  try {
    await run()
  } finally {
    globalThis.fetch = original
  }
}

function stubJson(status, body, headers = {}) {
  return async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

/** Key one request authenticated with (or `keyless`). */
function requestKey(init) {
  const authorization = init.headers.authorization
  return typeof authorization === 'string' ? authorization.slice('Bearer '.length) : 'keyless'
}

const { provider, warnings } = registerProvider({ maxResults: 4, includeAnswer: true })
assert.equal(provider.id, 'tavily')
assert.equal(provider.title, 'Tavily')
assert.equal(provider.available(), true)
for (const language of ['en', 'zh', 'ja', 'es', 'fr', 'de', 'ru', 'pt']) {
  assert.equal(typeof provider.description[language], 'string', `description.${language}`)
}

// The environment is not allowed to leak a key into the keyless cases below.
const previousKey = process.env.TAVILY_API_KEY
delete process.env.TAVILY_API_KEY

await withStubFetch(async (url, init) => {
  const body = JSON.parse(init.body)
  assert.equal(url, 'https://api.tavily.com/search')
  assert.equal(init.method, 'POST')
  assert.equal(init.headers['x-tavily-access-mode'], 'keyless')
  assert.equal(init.headers.authorization, undefined)
  assert.equal(body.query, 'mars rover')
  assert.equal(body.search_depth, 'basic')
  assert.equal(body.include_answer, true)
  assert.equal(body.max_results, 4)
  assert.equal(body.include_published_date, true)
  return stubJson(200, {
    answer: 'A rover on Mars.',
    results: [
      {
        title: 'Mars rover',
        url: 'https://example.com/mars',
        content: 'Mars rover content.',
        published_date: 'Tue, 11 Mar 2025 17:00:00 GMT',
      },
      { title: 'Duplicate', url: 'https://example.com/mars', content: 'dup' },
      { url: 'https://example.com/no-title' },
      { title: 'Broken' },
    ],
  })()
}, async () => {
  const result = await provider.search({ query: '  mars rover  ', maxResults: 4 })
  assert.equal(result.truncated, false)
  assert.equal(result.content, 'A rover on Mars.')
  assert.deepEqual(result.sources, [
    {
      url: 'https://example.com/mars',
      title: 'Mars rover',
      summary: 'Mars rover content.',
      publishedAt: '2025-03-11T17:00:00.000Z',
    },
    { url: 'https://example.com/no-title' },
  ])
})

// A literal configured key authenticates with Bearer and skips keyless mode.
const keyedProvider = registerProvider({ apiKey: 'tvly-config-key' }).provider
await withStubFetch(async (_url, init) => {
  assert.equal(init.headers.authorization, 'Bearer tvly-config-key')
  assert.equal(init.headers['x-tavily-access-mode'], undefined)
  return stubJson(200, { results: [] })()
}, async () => {
  await keyedProvider.search({ query: 'q' })
})

// An environment key is equivalent, and a literal key wins over the environment.
process.env.TAVILY_API_KEY = 'tvly-env-key'
try {
  const envProvider = registerProvider({}).provider
  await withStubFetch(async (_url, init) => {
    assert.equal(init.headers.authorization, 'Bearer tvly-env-key')
    return stubJson(200, { results: [] })()
  }, async () => {
    await envProvider.search({ query: 'q' })
  })

  await withStubFetch(async (_url, init) => {
    assert.equal(init.headers.authorization, 'Bearer tvly-config-key')
    return stubJson(200, { results: [] })()
  }, async () => {
    await keyedProvider.search({ query: 'q' })
  })
} finally {
  delete process.env.TAVILY_API_KEY
}

// Credential references supply numbered keys, resolved per search.
const storedValues = { TAVILY_API_KEY: 'key-a', TAVILY_API_KEY_2: 'key-b' }
const storedProvider = registerProvider({}, { credentials: credentialsOf(storedValues) }).provider
await withStubFetch(async (_url, init) => {
  assert.equal(requestKey(init), 'key-a')
  return stubJson(200, { results: [{ url: 'https://example.com/a' }] })()
}, async () => {
  await storedProvider.search({ query: 'q' })
})
storedValues.TAVILY_API_KEY_3 = 'key-c'
await withStubFetch(async (_url, init) => {
  assert.equal(requestKey(init), 'key-b', 'rotation starts at the next key and sees a key added after load')
  return stubJson(200, { results: [] })()
}, async () => {
  await storedProvider.search({ query: 'q' })
})

// A rate-limited key is skipped and the search continues with the next key;
// the loopback status route reports each reference's last outcome.
{
  const calls = []
  const registration = registerProvider({}, {
    credentials: credentialsOf({ TAVILY_API_KEY: 'key-rate', TAVILY_API_KEY_2: 'key-ok' }),
  })
  const rotating = registration.provider
  await withStubFetch(async (_url, init) => {
    const key = requestKey(init)
    calls.push(key)
    return key === 'key-rate'
      ? stubJson(429, { detail: { error: { code: 'rate_limit', message: 'slow down' } } })()
      : stubJson(200, { results: [{ url: 'https://example.com/next' }] })()
  }, async () => {
    const result = await rotating.search({ query: 'q' })
    assert.equal(result.sources[0].url, 'https://example.com/next')
  })
  assert.deepEqual(calls, ['key-rate', 'key-ok'])

  assert.equal(registration.routes.length, 1)
  const route = registration.routes[0]
  assert.equal(route.kind, 'exact')
  assert.equal(route.path, '/_dsh/tavily-websearch/status')
  const payload = await route.resource().json()
  assert.equal(payload.keys.TAVILY_API_KEY.state, 'rate_limited')
  assert.equal(payload.keys.TAVILY_API_KEY.httpStatus, 429)
  assert.equal(payload.keys.TAVILY_API_KEY_2.state, 'ok')

  // A replaced key is unverified until it is used again.
  const onReferenceUpdated = registration.listeners.get('credentials/reference-updated')
  onReferenceUpdated('TAVILY_API_KEY_2')
  const cleared = await route.resource().json()
  assert.equal(cleared.keys.TAVILY_API_KEY_2, undefined)
}

// Two references holding the same key share one attempt and both report its health.
{
  const duplicate = registerProvider({}, {
    credentials: credentialsOf({ TAVILY_API_KEY: 'same-key', TAVILY_API_KEY_2: 'same-key' }),
  })
  let attempts = 0
  await withStubFetch(async () => {
    attempts += 1
    return stubJson(200, { results: [] })()
  }, async () => {
    await duplicate.provider.search({ query: 'q' })
  })
  assert.equal(attempts, 1)
  const payload = await duplicate.routes[0].resource().json()
  assert.equal(payload.keys.TAVILY_API_KEY.state, 'ok')
  assert.equal(payload.keys.TAVILY_API_KEY_2.state, 'ok')
}

// A rejected key (401) is remembered and not retried on the next search.
{
  const calls = []
  const rejecting = registerProvider({}, {
    credentials: credentialsOf({ TAVILY_API_KEY: 'key-bad', TAVILY_API_KEY_2: 'key-good' }),
  }).provider
  await withStubFetch(async (_url, init) => {
    const key = requestKey(init)
    calls.push(key)
    return key === 'key-bad'
      ? stubJson(401, { detail: { error: 'Unauthorized' } })()
      : stubJson(200, { results: [] })()
  }, async () => {
    await rejecting.search({ query: 'one' })
    await rejecting.search({ query: 'two' })
  })
  assert.deepEqual(calls, ['key-bad', 'key-good', 'key-good'])
}

// Every key failing falls back to keyless mode and warns the deployment log.
{
  const calls = []
  const fallback = registerProvider({ apiKey: 'key-bad' })
  await withStubFetch(async (_url, init) => {
    const key = requestKey(init)
    calls.push(key)
    return key === 'keyless'
      ? stubJson(200, { results: [{ url: 'https://example.com/free' }] })()
      : stubJson(401, { detail: { error: 'Unauthorized' } })()
  }, async () => {
    const result = await fallback.provider.search({ query: 'q' })
    assert.equal(result.sources[0].url, 'https://example.com/free')
  })
  assert.deepEqual(calls, ['key-bad', 'keyless'])
  assert.equal(fallback.warnings.length, 1)
}

// Disabling the fallback reports the key failures instead of searching anonymously.
await withStubFetch(async (_url, init) => {
  assert.equal(requestKey(init), 'key-bad')
  return stubJson(401, { detail: { error: 'Unauthorized' } })()
}, async () => {
  const strict = registerProvider({ apiKey: 'key-bad', keylessFallback: false }).provider
  await assert.rejects(
    strict.search({ query: 'q' }),
    (error) => error.code === 'WEB_PROVIDER_ERROR' && /every configured key/u.test(error.message),
  )
})

// With no key and no fallback the failure explains the configuration.
{
  const strict = registerProvider({ keylessFallback: false }).provider
  await assert.rejects(
    strict.search({ query: 'q' }),
    (error) => /no Tavily API key is configured and keyless fallback is disabled/u.test(error.message),
  )
}

// Tavily's nested error object and Retry-After survive into the message.
await withStubFetch(async () => new Response(JSON.stringify({
  detail: { error: { code: 'daily_cap_reached', message: 'You reached the daily keyless Tavily limit.' } },
}), {
  status: 429,
  headers: { 'content-type': 'application/json', 'retry-after': '60' },
}), async () => {
  await assert.rejects(
    provider.search({ query: 'q' }),
    (error) => /daily keyless Tavily limit/u.test(error.message) && /Retry after 60s/u.test(error.message),
  )
})

await withStubFetch(async () => {
  const error = new Error('aborted')
  error.name = 'AbortError'
  throw error
}, async () => {
  await assert.rejects(provider.search({ query: 'q' }), (error) => error.code === 'WEB_ABORTED')
})

// Invalid row configuration fails at load, not on the first search.
assert.throws(() => registerProvider({ searchDepth: 'deep' }), /searchDepth/u)
assert.throws(() => registerProvider({ maxResults: 50 }), /maxResults/u)
assert.throws(() => registerProvider({ baseURL: 'ftp://example.com' }), /http or https/u)
assert.throws(() => registerProvider({ apiKeyEnv: 'not valid' }), /apiKeyEnv/u)
assert.throws(() => registerProvider({ apiKeys: [''] }), /apiKeys/u)
assert.throws(() => registerProvider({ keylessFallback: 'yes' }), /keylessFallback/u)

if (previousKey !== undefined) process.env.TAVILY_API_KEY = previousKey

console.log('stub checks passed')

if (process.argv.includes('--live')) {
  try {
    const result = await provider.search({ query: 'Tavily API features for search and extract', maxResults: 3 })
    assert.ok(result.sources.length > 0, 'live keyless search must return sources')
    for (const source of result.sources) assert.match(source.url, /^https?:\/\//u)
    console.log(`live keyless search returned ${result.sources.length} sources`)
  } catch (error) {
    // Keyless quota is per network; a capped run still exercises the live transport.
    if (error.code === 'WEB_PROVIDER_ERROR' && /HTTP 429/u.test(error.message)) {
      console.log('live keyless search skipped: Tavily keyless daily cap reached')
    } else throw error
  }
}
