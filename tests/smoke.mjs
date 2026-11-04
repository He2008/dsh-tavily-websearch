/**
 * Smoke checks for the Tavily bundle. The default run stubs `fetch`, so it
 * verifies request construction and response mapping offline. `--live` performs
 * one real keyless search against api.tavily.com.
 */
import assert from 'node:assert/strict'

import { apply } from '../index.js'

/** Register the provider against a stub context and return it. */
function registerProvider(config = {}) {
  let provider
  const ctx = {
    web: {
      registerSearchProvider(candidate) {
        provider = candidate
      },
    },
  }
  apply(ctx, config)
  assert.ok(provider, 'apply must register a search provider')
  return provider
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

function stubJson(status, body) {
  return async () => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const provider = registerProvider({ maxResults: 4, includeAnswer: true })
assert.equal(provider.id, 'tavily')
assert.equal(provider.title, 'Tavily')
assert.equal(provider.available(), true)
assert.equal(typeof provider.description.en, 'string')
assert.equal(typeof provider.description.zh, 'string')

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

await withStubFetch(stubJson(401, { detail: { error: 'Unauthorized: missing or invalid API key.' } }), async () => {
  await assert.rejects(
    provider.search({ query: 'q' }),
    (error) => error.code === 'WEB_PROVIDER_ERROR' && /TAVILY_API_KEY/u.test(error.message),
  )
})

await withStubFetch(async () => {
  const error = new Error('aborted')
  error.name = 'AbortError'
  throw error
}, async () => {
  await assert.rejects(provider.search({ query: 'q' }), (error) => error.code === 'WEB_ABORTED')
})

// A literal configured key must authenticate with Bearer and skip keyless mode.
const keyedProvider = registerProvider({ apiKey: 'tvly-config-key' })
await withStubFetch(async (_url, init) => {
  assert.equal(init.headers.authorization, 'Bearer tvly-config-key')
  assert.equal(init.headers['x-tavily-access-mode'], undefined)
  return stubJson(200, { results: [] })()
}, async () => {
  await keyedProvider.search({ query: 'q' })
})

// The env-var key is equivalent, and a literal key wins over the environment.
const previousKey = process.env.TAVILY_API_KEY
process.env.TAVILY_API_KEY = 'tvly-env-key'
try {
  const envProvider = registerProvider({})
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
  if (previousKey === undefined) delete process.env.TAVILY_API_KEY
  else process.env.TAVILY_API_KEY = previousKey
}

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

// Invalid row configuration fails at load, not on the first search.
assert.throws(() => registerProvider({ searchDepth: 'deep' }), /searchDepth/u)
assert.throws(() => registerProvider({ maxResults: 50 }), /maxResults/u)
assert.throws(() => registerProvider({ baseURL: 'ftp://example.com' }), /http or https/u)

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
