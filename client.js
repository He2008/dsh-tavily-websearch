window.__ModuleLoader__.load({
  id: 'dsh-tavily-websearch',
  factory(require) {
    const React = require('react')
    const ReactDOM = require('react-dom')

    /** Locale namespace owned by this bundle's configuration card. */
    const NS = 'tavily-websearch'
    /** First reference; the Host appends `_2` … `_8` for the remaining slots. */
    const KEY_BASE = 'TAVILY_API_KEY'
    const KEY_SLOTS = 8
    const KEY_REFS = Array.from({ length: KEY_SLOTS }, (_, index) =>
      index === 0 ? KEY_BASE : `${KEY_BASE}_${index + 1}`)
    /** Same-origin Host route carrying each reference's last network outcome. */
    const HEALTH_PATH = '/_dsh/tavily-websearch/status'
    const HEALTH_POLL_MS = 5000

    const messages = {
      en: {
        title: 'Tavily API keys',
        summary: 'Tavily API keys: {count} of {total} configured, {usable} usable',
        summaryKeyless: 'Tavily API keys: using keyless mode',
        description: 'Add one or more Tavily keys to use your account limits. Keys are stored in the DSH credential store and never shown again.',
        loading: 'Reading configured keys…',
        refresh: 'Refresh',
        keyless: 'No key is configured, so web_search uses Tavily keyless mode (rate-limited).',
        keysConfigured: '{count} of {total} keys configured.',
        keyLabel: 'Key {index}',
        configured: 'Configured',
        empty: 'Not configured',
        sourceEnv: 'Environment',
        sourceFile: 'Credential store',
        sourceProjectEnv: 'Project .env',
        sourceUserEnv: 'User .env',
        add: 'Add',
        replace: 'Replace',
        save: 'Save',
        cancel: 'Cancel',
        remove: 'Delete',
        editing: 'Setting key {index} ({reference})',
        addTitle: 'Add key {index}',
        replaceTitle: 'Replace key {index}',
        modalHint: 'Paste the Tavily key. It is stored in the DSH credential store; the full value is shown again only for this page.',
        placeholder: 'Paste a Tavily key, e.g. tvly-…',
        rotation: 'Searches rotate across keys; a rejected or rate-limited key is skipped. If every key fails, keyless mode is used when enabled.',
        envManaged: 'This key comes from the environment; delete the variable instead.',
        stateOk: 'Usable',
        stateInvalid: 'Rejected',
        stateRateLimited: 'Rate-limited',
        stateError: 'Error',
        stateUnknown: 'Not used yet',
        statusUnavailable: 'Runtime key status is unavailable; results below come from the last network attempt only.',
        saved: 'Key saved.',
        lastSaved: 'Last saved in this page: {reference} = {value} (page-local only; a reload hides it again)',
        removed: 'Key deleted.',
        saveFailed: 'Could not save the key: {error}',
        notPersisted: 'The key was accepted but the credential store still reports {reference} as unset. Try Refresh.',
        removeFailed: 'Could not delete the key: {error}',
        loadFailed: 'Could not read the configured keys: {error}',
        credentialsUnavailable: 'The credential service is unavailable, so keys cannot be changed here.',
        retry: 'Retry',
      },
      zh: {
        title: 'Tavily API Key',
        summary: 'Tavily API Key：已配置 {count}/{total}，可用 {usable}',
        summaryKeyless: 'Tavily API Key：当前使用免密钥模式',
        description: '添加一个或多个 Tavily Key 以使用账户额度。Key 保存在 DSH 凭据库中，保存后不再显示。',
        loading: '正在读取已配置的 Key…',
        refresh: '刷新',
        keyless: '尚未配置 Key，web_search 当前使用 Tavily 免密钥模式（有限速）。',
        keysConfigured: '已配置 {count}/{total} 个 Key。',
        keyLabel: 'Key {index}',
        configured: '已配置',
        empty: '未配置',
        sourceEnv: '环境变量',
        sourceFile: '凭据库',
        sourceProjectEnv: '项目 .env',
        sourceUserEnv: '用户 .env',
        add: '添加',
        replace: '替换',
        save: '保存',
        cancel: '取消',
        remove: '删除',
        editing: '正在设置 Key {index}（{reference}）',
        addTitle: '添加 Key {index}',
        replaceTitle: '替换 Key {index}',
        modalHint: '粘贴 Tavily Key。它会写入 DSH 凭据库；完整值仅在当前页面内再次显示。',
        placeholder: '粘贴 Tavily Key，例如 tvly-…',
        rotation: '搜索会在多个 Key 之间轮换，被拒绝或限流的 Key 会被跳过。全部失败时，如已启用则回退到免密钥模式。',
        envManaged: '该 Key 来自环境变量，请删除对应的环境变量。',
        stateOk: '可用',
        stateInvalid: '已失效',
        stateRateLimited: '限流',
        stateError: '错误',
        stateUnknown: '未使用',
        statusUnavailable: '运行时 Key 状态不可用；下方显示的是上一次网络请求的结果。',
        saved: 'Key 已保存。',
        lastSaved: '本次页面内最后保存：{reference} = {value}（仅当前页面可见，刷新后不再显示）',
        removed: 'Key 已删除。',
        saveFailed: '保存失败：{error}',
        notPersisted: 'Key 已被接受，但凭据库仍显示 {reference} 未配置。请点“刷新”重试。',
        removeFailed: '删除失败：{error}',
        loadFailed: '读取已配置的 Key 失败：{error}',
        credentialsUnavailable: '凭据服务不可用，无法在这里修改 Key。',
        retry: '重试',
      },
    }

    const color = {
      text: 'var(--dsw-alias-label-primary, inherit)',
      muted: 'var(--dsw-alias-label-secondary, #6b7280)',
      border: 'var(--dsw-alias-border-l1, #e5e7eb)',
      surface: 'var(--dsw-alias-bg-layer-1, transparent)',
      raised: 'var(--dsw-alias-bg-layer-2, rgba(0,0,0,0.04))',
      danger: 'var(--dsw-alias-state-error-primary, #dc2626)',
      warn: 'var(--dsw-alias-state-warn-primary, #b45309)',
      success: 'var(--dsw-alias-state-success-primary, #15803d)',
      accent: 'var(--dsw-alias-brand-primary, #2563eb)',
    }

    const styles = {
      root: { display: 'flex', flexDirection: 'column', gap: '8px', color: color.text, fontSize: '13px' },
      header: { display: 'flex', alignItems: 'center', gap: '8px' },
      heading: { margin: 0, fontSize: '13px', fontWeight: 600 },
      hint: { margin: 0, color: color.muted, fontSize: '12px', lineHeight: 1.5 },
      error: { margin: 0, color: color.danger, fontSize: '12px', lineHeight: 1.5 },
      list: { display: 'flex', flexDirection: 'column', gap: '2px' },
      row: {
        display: 'flex', alignItems: 'center', gap: '8px', rowGap: '4px', flexWrap: 'wrap',
        minHeight: '32px', padding: '2px 0', borderBottom: `1px solid ${color.border}`,
      },
      keyLabel: { fontWeight: 500, whiteSpace: 'nowrap' },
      reference: {
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '11px',
        color: color.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        maxWidth: '170px',
      },
      badge: {
        padding: '1px 6px', borderRadius: '4px', background: color.raised,
        color: color.muted, fontSize: '11px', lineHeight: '16px', whiteSpace: 'nowrap',
      },
      badgeSuccess: {
        padding: '1px 6px', borderRadius: '4px', background: color.raised,
        color: color.success, fontSize: '11px', lineHeight: '16px', whiteSpace: 'nowrap',
      },
      badgeWarn: {
        padding: '1px 6px', borderRadius: '4px', background: color.raised,
        color: color.warn, fontSize: '11px', lineHeight: '16px', whiteSpace: 'nowrap',
      },
      badgeDanger: {
        padding: '1px 6px', borderRadius: '4px', background: color.raised,
        color: color.danger, fontSize: '11px', lineHeight: '16px', whiteSpace: 'nowrap',
      },
      source: { color: color.muted, fontSize: '11px', whiteSpace: 'nowrap' },
      spacer: { flex: 1 },
      overlay: {
        position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '16px', background: 'rgba(0, 0, 0, 0.38)',
      },
      dialog: {
        width: 'min(440px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', gap: '10px', padding: '16px', borderRadius: '10px',
        border: `1px solid ${color.border}`, background: 'var(--dsw-alias-bg-overlay, #fff)',
        color: color.text, boxShadow: '0 16px 40px rgba(0, 0, 0, 0.28)',
      },
      dialogTitle: { margin: 0, fontSize: '14px', fontWeight: 600 },
      dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px' },
      input: {
        width: '100%', boxSizing: 'border-box', padding: '6px 8px', font: 'inherit', color: color.text,
        background: color.surface, border: `1px solid ${color.border}`, borderRadius: '6px',
      },
      button: {
        padding: '5px 10px', font: 'inherit', color: color.text, background: color.surface,
        border: `1px solid ${color.border}`, borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap',
      },
      primary: {
        padding: '5px 10px', font: 'inherit', color: '#fff', background: color.accent,
        border: '1px solid transparent', borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap',
      },
      danger: {
        padding: '5px 10px', font: 'inherit', color: color.danger, background: color.surface,
        border: `1px solid ${color.border}`, borderRadius: '6px', cursor: 'pointer', whiteSpace: 'nowrap',
      },
      disabled: { opacity: 0.5, cursor: 'not-allowed' },
    }

    /** Human label for the layer that supplies a configured reference. */
    function sourceLabel(source, t) {
      switch (source) {
        case 'env': return t('sourceEnv')
        case 'file': return t('sourceFile')
        case 'project-env': return t('sourceProjectEnv')
        case 'user-env': return t('sourceUserEnv')
        default: return source ?? ''
      }
    }

    /** Readable message from a thrown value, never a raw object dump. */
    function messageOf(value) {
      if (value instanceof Error) return value.message
      if (typeof value === 'string') return value
      return 'unknown error'
    }

    /** Badge text, style, and tooltip for one reference's last network outcome. */
    function runtimeBadge(entry, t) {
      switch (entry?.state) {
        case 'ok': return { label: t('stateOk'), style: styles.badgeSuccess }
        case 'invalid': return { label: t('stateInvalid'), style: styles.badgeDanger }
        case 'rate_limited': return { label: t('stateRateLimited'), style: styles.badgeWarn }
        case 'error': return { label: t('stateError'), style: styles.badgeDanger }
        default: return { label: t('stateUnknown'), style: styles.badge }
      }
    }

    /**
     * Bundle page card: list every key slot with its configuration state and
     * last network outcome, and add, replace, or delete keys through the
     * credential Remote namespace.
     * @param {object} props - slot owner props plus the injected credentials face.
     * @returns {object | null} the configuration card, or null outside the page view.
     */
    function TavilyConfigCard(props) {
      const { t, credentials, refs, view } = props
      const [entries, setEntries] = React.useState(null)
      const [health, setHealth] = React.useState({ available: false, keys: {} })
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [draft, setDraft] = React.useState('')
      const [saving, setSaving] = React.useState(false)
      const [editing, setEditing] = React.useState(null)
      const [lastSaved, setLastSaved] = React.useState(null)
      const inputId = React.useId()
      const titleId = React.useId()
      const inputRef = React.useRef(null)
      const translate = React.useRef(t)
      translate.current = t

      const refresh = React.useCallback(async () => {
        if (typeof credentials?.describe !== 'function') {
          setEntries({})
          setError(translate.current('credentialsUnavailable'))
          return
        }
        try {
          const described = await credentials.describe(refs)
          setEntries(described)
          setError('')
        } catch (failure) {
          setEntries({})
          setError(translate.current('loadFailed', { error: messageOf(failure) }))
        }
      }, [credentials, refs])

      const refreshHealth = React.useCallback(async () => {
        try {
          const response = await fetch(HEALTH_PATH, { cache: 'no-store' })
          if (!response.ok) throw new Error(`HTTP ${response.status}`)
          const payload = await response.json()
          const keys = payload !== null && typeof payload === 'object' && typeof payload.keys === 'object' && payload.keys !== null
            ? payload.keys
            : {}
          setHealth({ available: true, keys })
          const refs = payload !== null && typeof payload === 'object'
            && typeof payload.refs === 'object' && payload.refs !== null
            ? payload.refs
            : undefined
          if (refs !== undefined) {
            setEntries(previous => {
              const merged = { ...(previous ?? {}) }
              for (const [reference, info] of Object.entries(refs)) {
                if (info === null || typeof info !== 'object') continue
                merged[reference] = { ...merged[reference], ...info }
              }
              return merged
            })
          }
        } catch {
          setHealth(previous => ({ available: false, keys: previous.keys }))
        }
      }, [])

      React.useEffect(() => { if (editing !== null) inputRef.current?.focus() }, [editing])
      React.useEffect(() => { void refresh() }, [refresh])
      React.useEffect(() => {
        void refreshHealth()
        const timer = setInterval(() => { void refreshHealth() }, HEALTH_POLL_MS)
        return () => { clearInterval(timer) }
      }, [refreshHealth])

      const configured = refs.filter(reference => entries?.[reference]?.configured === true)
      if (view === 'summary') {
        const usable = configured.filter(reference => health.keys[reference]?.state === 'ok').length
        return React.createElement('span', { style: styles.hint }, configured.length === 0
          ? t('summaryKeyless')
          : t('summary', { count: configured.length, total: refs.length, usable }))
      }
      // A host that omits `view` still renders the page body; only a declared
      // non-page view is skipped.
      if (view !== undefined && view !== 'page') return null

      const disabled = saving

      const startEdit = (reference) => {
        setEditing(reference)
        setDraft('')
        setNotice('')
        setError('')
      }

      const cancelEdit = () => {
        setEditing(null)
        setDraft('')
      }

      const submit = async () => {
        const value = draft.trim()
        if (editing === null || value.length === 0) return
        if (typeof credentials?.set !== 'function' || typeof credentials?.describe !== 'function') {
          setError(t('credentialsUnavailable'))
          return
        }
        setSaving(true)
        setError('')
        setNotice('')
        try {
          await credentials.set(editing, value)
        } catch (failure) {
          setError(t('saveFailed', { error: messageOf(failure) }))
          setSaving(false)
          return
        }
        try {
          const described = await credentials.describe(refs)
          setEntries(described)
          if (described[editing]?.configured === true) {
            setLastSaved({ reference: editing, value })
            setDraft('')
            setEditing(null)
            setNotice(t('saved'))
          } else {
            setError(t('notPersisted', { reference: editing }))
          }
        } catch (failure) {
          setError(t('loadFailed', { error: messageOf(failure) }))
        } finally {
          setSaving(false)
          void refreshHealth()
        }
      }

      const remove = async (reference) => {
        if (typeof credentials?.unset !== 'function') {
          setError(t('credentialsUnavailable'))
          return
        }
        setSaving(true)
        setError('')
        setNotice('')
        try {
          await credentials.unset(reference)
          if (editing === reference) cancelEdit()
          setNotice(t('removed'))
          await refresh()
          void refreshHealth()
        } catch (failure) {
          setError(t('removeFailed', { error: messageOf(failure) }))
        } finally {
          setSaving(false)
        }
      }

      const rows = refs.map((reference, index) => {
        const entry = entries?.[reference] ?? {}
        const isConfigured = entry.configured === true
        const fromStore = entry.source === 'file'
        const canWrite = entry.writable !== false
        const showSource = isConfigured && entry.source !== undefined
        const runtime = runtimeBadge(health.keys[reference], t)
        const runtimeEntry = health.keys[reference]
        const runtimeTitle = runtimeEntry === undefined
          ? t('stateUnknown')
          : `${runtime.label}${runtimeEntry.httpStatus === undefined ? '' : ` · HTTP ${runtimeEntry.httpStatus}`}${runtimeEntry.at === undefined ? '' : ` · ${new Date(runtimeEntry.at).toLocaleTimeString()}`}`
        return React.createElement('div', { key: reference, style: styles.row },
          React.createElement('span', { style: styles.keyLabel }, t('keyLabel', { index: index + 1 })),
          React.createElement('code', { style: styles.reference }, reference),
          isConfigured && typeof entry.hint === 'string'
            ? React.createElement('span', { style: styles.reference }, `…${entry.hint}`)
            : null,
          React.createElement('span', { style: isConfigured ? styles.badgeSuccess : styles.badge },
            isConfigured ? t('configured') : t('empty')),
          isConfigured && health.available
            ? React.createElement('span', { style: runtime.style, title: runtimeTitle }, runtime.label)
            : null,
          showSource ? React.createElement('span', { style: styles.source }, sourceLabel(entry.source, t)) : null,
          React.createElement('span', { style: styles.spacer }),
          isConfigured
            ? React.createElement(React.Fragment, null,
              React.createElement('button', {
                type: 'button',
                style: disabled || !canWrite ? { ...styles.button, ...styles.disabled } : styles.button,
                disabled: disabled || !canWrite,
                onClick: () => startEdit(reference),
              }, t('replace')),
              React.createElement('button', {
                type: 'button',
                style: disabled || !canWrite || !fromStore ? { ...styles.danger, ...styles.disabled } : styles.danger,
                disabled: disabled || !canWrite || !fromStore,
                title: fromStore ? undefined : t('envManaged'),
                onClick: () => { void remove(reference) },
              }, t('remove')),
            )
            : React.createElement('button', {
              type: 'button',
              style: disabled || !canWrite ? { ...styles.button, ...styles.disabled } : styles.button,
              disabled: disabled || !canWrite,
              onClick: () => startEdit(reference),
            }, t('add')),
        )
      })

      const modal = editing === null || typeof document === 'undefined' ? null : ReactDOM.createPortal(
        React.createElement('div', {
          style: styles.overlay,
          onMouseDown: (event) => { if (event.target === event.currentTarget) cancelEdit() },
          onKeyDown: (event) => {
            if (event.key !== 'Escape') return
            event.preventDefault()
            cancelEdit()
          },
        },
          React.createElement('div', {
            role: 'dialog',
            'aria-modal': 'true',
            'aria-labelledby': titleId,
            style: styles.dialog,
          },
            React.createElement('h3', { id: titleId, style: styles.dialogTitle },
              entries?.[editing]?.configured === true
                ? t('replaceTitle', { index: refs.indexOf(editing) + 1 })
                : t('addTitle', { index: refs.indexOf(editing) + 1 })),
            React.createElement('p', { style: styles.hint }, t('modalHint')),
            React.createElement('input', {
              id: inputId,
              ref: inputRef,
              type: 'text',
              style: styles.input,
              value: draft,
              placeholder: t('placeholder'),
              'aria-label': t('keyLabel', { index: refs.indexOf(editing) + 1 }),
              autoComplete: 'off',
              autoCorrect: 'off',
              autoCapitalize: 'none',
              spellCheck: false,
              'data-1p-ignore': 'true',
              'data-lpignore': 'true',
              'data-form-type': 'other',
              disabled,
              onChange: event => setDraft(event.target.value),
              onKeyDown: (event) => {
                if (event.key !== 'Enter') return
                event.preventDefault()
                void submit()
              },
            }),
            error.length > 0
              ? React.createElement('p', { role: 'status', style: styles.error }, error)
              : null,
            React.createElement('div', { style: styles.dialogActions },
              React.createElement('button', {
                type: 'button',
                style: styles.button,
                disabled,
                onClick: cancelEdit,
              }, t('cancel')),
              React.createElement('button', {
                type: 'button',
                style: draft.trim().length === 0 || disabled ? { ...styles.primary, ...styles.disabled } : styles.primary,
                disabled: disabled || draft.trim().length === 0,
                onClick: () => { void submit() },
              }, t('save')),
            ),
          ),
        ),
        document.body,
      )

      const card = React.createElement('div', { style: styles.root },
        React.createElement('div', { style: styles.header },
          React.createElement('h4', { style: styles.heading }, t('title')),
          React.createElement('span', { style: styles.spacer }),
          React.createElement('button', {
            type: 'button', style: styles.button, disabled,
            onClick: () => { void refresh(); void refreshHealth() },
          }, t('refresh')),
        ),
        React.createElement('p', { style: styles.hint }, t('description')),
        entries === null
          ? React.createElement('p', { style: styles.hint }, t('loading'))
          : React.createElement(React.Fragment, null,
            React.createElement('p', { style: styles.hint }, configured.length === 0
              ? t('keyless')
              : t('keysConfigured', { count: configured.length, total: refs.length })),
            React.createElement('div', { style: styles.list }, rows),
            lastSaved === null ? null : React.createElement('p', { style: styles.hint },
              React.createElement('code', { style: styles.reference }, t('lastSaved', {
                reference: lastSaved.reference,
                value: lastSaved.value,
              }))),
            React.createElement('p', { style: styles.hint }, t('rotation')),
            health.available ? null : React.createElement('p', { style: styles.hint }, t('statusUnavailable')),
            error.length > 0
              ? React.createElement('p', { role: 'status', style: styles.error }, error,
                ' ',
                React.createElement('button', {
                  type: 'button', style: styles.button, onClick: () => { void refresh(); void refreshHealth() },
                }, t('retry')))
              : notice.length > 0
                ? React.createElement('p', { role: 'status', style: styles.hint }, notice)
                : null,
          ),
      )
      return React.createElement(React.Fragment, null, card, modal)
    }

    return {
      inject: ['slots', 'locale', 'remote', 'remote.credentials'],
      /**
       * Register the card on the bundle's own Plugins page.
       * @param {object} ctx - client plugin context.
       */
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, messages), 'tavily-websearch: dictionaries')
        ctx.slots.inject('plugins.bundle.config', () => ctx.slots.register({
          name: 'plugins.bundle.config',
          key: 'dsh-tavily-websearch',
          order: 0,
          locale: NS,
          inject: () => ({ credentials: ctx.remote?.credentials, refs: KEY_REFS }),
        }, TavilyConfigCard))
      },
    }
  },
})
