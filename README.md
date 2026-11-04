# dsh-tavily-websearch

A DeepSeek Harness plugin bundle that registers a Tavily search provider on
`ctx.web`, so the shipped `web_search` tool is served by Tavily with unchanged
tool schema, source cards, and error reporting.

## Install

Through Plugin Manager, pointing at the repository:

```text
plugin_manager install_bundle target=github:He2008/dsh-tavily-websearch
```

Or from a local checkout:

```text
plugin_manager install_bundle target=/absolute/path/to/dsh-tavily-websearch
```

The bundle patch registers the host row and selects `tavily` as the search
provider (`searchProvider: tavily`, `fetchProvider: http`). A later profile
patch layer can override either selection.

## Behavior

- `POST {baseURL}/search` with `search_depth`, `include_published_date`, and the
  seam's `maxResults` forwarded as `max_results`.
- Tavily `results[].title` / `url` / `content` / `published_date` map to the
  seam's `title` / `url` / `summary` / `publishedAt` (dates converted to ISO-8601).
- `answer` maps to the optional provider answer when `includeAnswer: true`.
- Without a key the request sends `X-Tavily-Access-Mode: keyless` (free,
  rate-limited). With a key it sends `Authorization: Bearer <key>`.
- Searches rotate across the configured keys. A `401`/`403` key is skipped for
  the rest of the process; a `429`/`432`/`433` key is skipped for the rest of
  that search and tried again later. When every key fails, keyless mode serves
  the search if `keylessFallback` is enabled.
- Aborts surface as `WEB_ABORTED`; HTTP and transport failures surface as
  `WEB_PROVIDER_ERROR` with Tavily's own message plus a recovery hint.

## Authentication

Tavily works out of the box: with no key the provider uses Tavily's keyless
access mode (free, rate-limited). To use account limits and billing, add one or
more keys from https://app.tavily.com.

### Settings card

Plugins → **Tavily web search** → the card under the bundle description manages
up to eight keys (references `TAVILY_API_KEY` and `TAVILY_API_KEY_2` …
`TAVILY_API_KEY_8`). Keys are written to the DSH credential store through the
`credentials` Remote namespace:

- The card lists all eight slots with their reference, status (**Configured**
  or **Not configured**), and supplying layer; the credential API never returns
  stored values.
- **Add** fills a free slot, **Replace** overwrites one, and **Delete** clears a
  stored key. A key that comes from the environment is read-only here — delete
  or change the variable instead.
- A saved key reaches the next search without restarting the Host.

### Environment

The same references resolve from the environment, so exporting them is
equivalent to using the card:

```sh
export TAVILY_API_KEY=tvly-first
export TAVILY_API_KEY_2=tvly-second
```

A running Host re-resolves references per search, so a variable exported before
the Host started is picked up without a plugin restart.

### Configuration

For a deployment that owns its composition, literal keys (discouraged: they sit
in the profile file) and the base reference are configurable:

```yaml
- id: tavily-websearch
  config:
    apiKeyEnv: TAVILY_API_KEY     # base reference; suffixes _2 … _8 follow
#   apiKeys: [tvly-...]           # literal keys, tried before references
#   keylessFallback: true         # search anonymously when every key fails
```

Never commit a literal key; if one leaks, rotate it in the Tavily dashboard.


## Row config reference

| Field | Default | Meaning |
| --- | --- | --- |
| `apiKey` | — | One literal key; prefer the card or `apiKeyEnv` so no secret enters configuration files. |
| `apiKeys` | `[]` | Literal keys tried before references; discouraged. |
| `apiKeyEnv` | `TAVILY_API_KEY` | Base reference; `_2` … `_8` are read as the remaining slots. |
| `keylessFallback` | `true` | Use keyless mode when every configured key fails. |
| `baseURL` | `https://api.tavily.com` | API origin; `/search` is appended when absent. |
| `searchDepth` | `basic` | `basic`, `advanced`, `fast`, or `ultra-fast`. |
| `includeAnswer` | `false` | Ask Tavily for an LLM-generated answer. |
| `maxResults` | `10` | Fallback cap when the tool passes none; Tavily accepts 1–20. |

The bundle also overrides the `web` row with `searchProvider: tavily` and
`fetchProvider: http`; a later layer in the profile patch can override either.

## Display metadata

`locale/{en,zh,ja,es,fr,de,ru,pt}.json` carry the Plugin Manager title and
description; the same eight languages are in the provider's picker description
in `index.js`. `icon.svg` is an original glyph. Plugin Manager and the Web
search settings page read these without activating the plugin.

## Verify

```sh
node --check index.js
node --check client.js
node tests/smoke.mjs          # mapping, rotation, failover, and fallback against stubs
node tests/smoke.mjs --live   # one real keyless search
```

After installation, open Plugins → Tavily web search: the key card should list
the configured slots. Call the `web_search` tool and confirm results come back
with Tavily sources.

## Why a bundle rather than a workspace package

The web seam is stable and provider plugins are the supported extension point;
this bundle needs no build step and no dependency on unpublished packages. It is
not a published `packages/web/*` product package.

## License

MIT. See [LICENSE](LICENSE).
