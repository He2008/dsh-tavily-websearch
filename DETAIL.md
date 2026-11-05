# Tavily web search

Serves the built-in `web_search` tool through Tavily. Result cards, source
format, and error reporting stay the same as with any other search provider.

## Configure keys

Open **Plugins → Tavily web search** and use the **Tavily API keys** card.

- Eight numbered slots map to `TAVILY_API_KEY`, `TAVILY_API_KEY_2` …
  `TAVILY_API_KEY_8`.
- **Add**, **Replace**, and **Delete** write to the DSH credential store; a key
  saved here reaches the next search without restarting the Host.
- Keys supplied by the environment are read-only in the card.
- With no key, searches use Tavily's rate-limited keyless mode.

## Key status

The card polls the Host after each search and shows the last network outcome
for every configured key.

| Status | Meaning |
| --- | --- |
| **Usable** | The last search with this key succeeded. |
| **Rate-limited** | Tavily returned 429/432/433; another key is tried and this one is retried later. |
| **Rejected** | Tavily returned 401/403; the key is skipped until the Host restarts or the key changes. |
| **Error** | A transport or server failure not caused by the key. |
| **Not used yet** | No search has used the key since the Host started. |

Searches rotate across keys. Two slots holding the same value count as one key.
When every key fails, keyless mode serves the search if `keylessFallback` is
enabled.

## Notes

- The credential API never returns stored values, so after a reload the card
  shows only the last four characters of each key. The value you just saved
  stays visible for the current page.
- Rotation, failover, and status live in memory. Replacing a key or restarting
  the Host resets its status.
