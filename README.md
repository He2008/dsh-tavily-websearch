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
- A literal `apiKey` wins over the `apiKeyEnv` environment variable, which wins
  over keyless mode.
- Aborts surface as `WEB_ABORTED`; HTTP and transport failures surface as
  `WEB_PROVIDER_ERROR` with Tavily's own message plus a recovery hint.

## Authentication

Tavily works out of the box: with no key the provider uses Tavily's keyless
access mode (free, rate-limited). To use account limits and billing, provide a
key from https://app.tavily.com in either way:

```sh
# Preferred: keep the secret out of configuration files.
export TAVILY_API_KEY=tvly-...
```

```yaml
# Bundle row config, for a deployment that owns this file.
- id: tavily-websearch
  config:
    apiKeyEnv: TAVILY_API_KEY
# or, when the environment cannot carry it:
#   apiKey: tvly-...
```

The running Host reads the environment variable per search, but a Host started
before the variable was set must restart to see it. Never commit a literal key;
if one leaks, rotate it in the Tavily dashboard.

## Configuration

Row config (in `cordis.patch.yml`):

| Field | Default | Meaning |
| --- | --- | --- |
| `apiKey` | — | Literal key; prefer `apiKeyEnv` so no secret enters configuration files. |
| `apiKeyEnv` | `TAVILY_API_KEY` | Environment variable read for the key. |
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
node tests/smoke.mjs          # mapping check against a stub response
node tests/smoke.mjs --live   # one real keyless search
```

After installation, call the `web_search` tool and confirm results come back
with Tavily sources.

## Why a bundle rather than a workspace package

The web seam is stable and provider plugins are the supported extension point;
this bundle needs no build step and no dependency on unpublished packages. It is
not a published `packages/web/*` product package.

## License

MIT. See [LICENSE](LICENSE).
