window.__ModuleLoader__.load({
  id: 'dsh-tavily-websearch',
  factory(require) {
    const React = require('react')

    /** Locale namespace owned by this bundle's configuration card. */
    const NS = 'tavily-websearch'
    /** First reference; the Host appends `_2` … `_8` for the remaining slots. */
    const KEY_BASE = 'TAVILY_API_KEY'
    const KEY_SLOTS = 8
    const KEY_REFS = Array.from({ length: KEY_SLOTS }, (_, index) =>
      index === 0 ? KEY_BASE : `${KEY_BASE}_${index + 1}`)

    const messages = {
      en: {
        title: 'Tavily API keys',
        description: 'Add one or more Tavily keys to use your account limits. Keys are stored in the DSH credential store and never shown again; use Replace to overwrite one.',
        loading: 'Reading configured keys…',
        keyless: 'No key is configured, so web_search uses Tavily keyless mode (rate-limited).',
        keysConfigured: '{count} of {total} keys configured.',
        keyLabel: 'Key {index}',
        configured: 'Configured',
        sourceEnv: 'Environment',
        sourceFile: 'Credential store',
        sourceProjectEnv: 'Project .env',
        sourceUserEnv: 'User .env',
        replace: 'Replace',
        cancel: 'Cancel',
        remove: 'Remove',
        add: 'Add key',
        save: 'Save key',
        placeholder: 'tvly-…',
        rotation: 'Searches rotate across keys; a rejected or rate-limited key is skipped. If every key fails, keyless mode is used when enabled.',
        allSlots: 'All key slots are in use. Replace or remove one to change it.',
        envManaged: 'This key comes from the environment; change the variable instead.',
        saved: 'Key saved.',
        removed: 'Key removed.',
        saveFailed: 'Could not save the key: {error}',
        loadFailed: 'Could not read the configured keys: {error}',
        retry: 'Retry',
      },
      zh: {
        title: 'Tavily API Key',
        description: '添加一个或多个 Tavily Key 以使用账户额度。Key 保存在 DSH 凭据库中，保存后不再显示；可用“替换”覆盖。',
        loading: '正在读取已配置的 Key…',
        keyless: '尚未配置 Key，web_search 当前使用 Tavily 免密钥模式（有限速）。',
        keysConfigured: '已配置 {count}/{total} 个 Key。',
        keyLabel: 'Key {index}',
        configured: '已配置',
        sourceEnv: '环境变量',
        sourceFile: '凭据库',
        sourceProjectEnv: '项目 .env',
        sourceUserEnv: '用户 .env',
        replace: '替换',
        cancel: '取消',
        remove: '移除',
        add: '添加 Key',
        save: '保存 Key',
        placeholder: 'tvly-…',
        rotation: '搜索会在多个 Key 之间轮换，被拒绝或限流的 Key 会被跳过。全部失败时，如已启用则回退到免密钥模式。',
        allSlots: '所有 Key 槽位都已使用，替换或移除一个后再添加。',
        envManaged: '该 Key 来自环境变量，请修改对应的环境变量。',
        saved: 'Key 已保存。',
        removed: 'Key 已移除。',
        saveFailed: '保存失败：{error}',
        loadFailed: '读取已配置的 Key 失败：{error}',
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
      accent: 'var(--dsw-alias-brand-primary, #2563eb)',
    }

    const styles = {
      root: { display: 'flex', flexDirection: 'column', gap: '8px', color: color.text, fontSize: '13px' },
      heading: { margin: 0, fontSize: '13px', fontWeight: 600 },
      hint: { margin: 0, color: color.muted, fontSize: '12px', lineHeight: 1.5 },
      error: { margin: 0, color: color.danger, fontSize: '12px', lineHeight: 1.5 },
      list: { display: 'flex', flexDirection: 'column', gap: '4px' },
      row: {
        display: 'flex', alignItems: 'center', gap: '8px', minHeight: '30px',
        padding: '2px 0', borderBottom: `1px solid ${color.border}`,
      },
      keyLabel: { fontWeight: 500, whiteSpace: 'nowrap' },
      badge: {
        padding: '1px 6px', borderRadius: '4px', background: color.raised,
        color: color.muted, fontSize: '11px', lineHeight: '16px', whiteSpace: 'nowrap',
      },
      source: { color: color.muted, fontSize: '11px', whiteSpace: 'nowrap' },
      spacer: { flex: 1 },
      form: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' },
      input: {
        flex: 1, minWidth: 0, padding: '6px 8px', font: 'inherit', color: color.text,
        background: color.surface, border: `1px solid ${color.border}`, borderRadius: '6px',
      },
      button: {
        padding: '5px 10px', font: 'inherit', color: color.text, background: color.surface,
        border: `1px solid ${color.border}`, borderRadius: '6px', cursor: 'pointer',
      },
      primary: {
        padding: '5px 10px', font: 'inherit', color: '#fff', background: color.accent,
        border: '1px solid transparent', borderRadius: '6px', cursor: 'pointer',
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

    /** Why a key cannot be edited from here, when the environment owns it. */
    function readOnlyReason(entry, t) {
      if (entry === undefined) return undefined
      if (entry.source !== undefined && entry.source !== 'file') return t('envManaged')
      if (entry.writable === false) return t('envManaged')
      return undefined
    }

    /**
     * Bundle page card: list which numbered keys are configured and add,
     * replace, or remove them through the credential Remote namespace.
     * @param {object} props - slot owner props plus the injected credentials face.
     * @returns {object | null} the configuration card, or null outside the page view.
     */
    function TavilyConfigCard(props) {
      const { t, credentials, refs, view } = props
      const [entries, setEntries] = React.useState(null)
      const [error, setError] = React.useState('')
      const [notice, setNotice] = React.useState('')
      const [draft, setDraft] = React.useState('')
      const [saving, setSaving] = React.useState(false)
      const [replacing, setReplacing] = React.useState(null)
      const inputId = React.useId()
      const translate = React.useRef(t)
      translate.current = t

      const refresh = React.useCallback(async () => {
        try {
          const described = await credentials.describe(refs)
          setEntries(described)
          setError('')
        } catch (failure) {
          setEntries({})
          setError(translate.current('loadFailed', { error: messageOf(failure) }))
        }
      }, [credentials, refs])

      React.useEffect(() => { void refresh() }, [refresh])

      if (view !== 'page') return null

      const configured = refs.filter(reference => entries?.[reference]?.configured === true)
      const firstFree = refs.find(reference => entries?.[reference]?.configured !== true) ?? null
      const target = replacing ?? firstFree
      const disabled = saving

      const submit = async (event) => {
        event.preventDefault()
        const value = draft.trim()
        if (target === null || value.length === 0) return
        setSaving(true)
        setError('')
        setNotice('')
        try {
          await credentials.set(target, value)
          setDraft('')
          setReplacing(null)
          setNotice(t('saved'))
          await refresh()
        } catch (failure) {
          setError(t('saveFailed', { error: messageOf(failure) }))
        } finally {
          setSaving(false)
        }
      }

      const remove = async (reference) => {
        setSaving(true)
        setError('')
        setNotice('')
        try {
          await credentials.unset(reference)
          if (replacing === reference) setReplacing(null)
          setNotice(t('removed'))
          await refresh()
        } catch (failure) {
          setError(t('saveFailed', { error: messageOf(failure) }))
        } finally {
          setSaving(false)
        }
      }

      const rows = configured.map((reference) => {
        const entry = entries[reference]
        const reason = readOnlyReason(entry, t)
        return React.createElement('div', { key: reference, style: styles.row },
          React.createElement('span', { style: styles.keyLabel }, t('keyLabel', { index: refs.indexOf(reference) + 1 })),
          React.createElement('span', { style: styles.badge }, t('configured')),
          entry?.source === undefined ? null
            : React.createElement('span', { style: styles.source }, sourceLabel(entry.source, t)),
          React.createElement('span', { style: styles.spacer }),
          React.createElement('button', {
            type: 'button',
            style: reason === undefined ? styles.button : { ...styles.button, ...styles.disabled },
            disabled: disabled || reason !== undefined,
            title: reason,
            onClick: () => { setReplacing(reference); setDraft(''); setNotice(''); setError('') },
          }, t('replace')),
          React.createElement('button', {
            type: 'button',
            style: reason === undefined ? styles.button : { ...styles.button, ...styles.disabled },
            disabled: disabled || reason !== undefined,
            title: reason,
            onClick: () => { void remove(reference) },
          }, t('remove')),
        )
      })

      const form = target === null
        ? React.createElement('p', { style: styles.hint }, t('allSlots'))
        : React.createElement('form', { style: styles.form, onSubmit: submit },
          React.createElement('input', {
            id: inputId,
            type: 'password',
            style: styles.input,
            value: draft,
            placeholder: t('placeholder'),
            'aria-label': t('keyLabel', { index: refs.indexOf(target) + 1 }),
            autoComplete: 'off',
            spellCheck: false,
            disabled,
            onChange: event => setDraft(event.target.value),
          }),
          React.createElement('button', {
            type: 'submit',
            style: draft.trim().length === 0 || disabled ? { ...styles.primary, ...styles.disabled } : styles.primary,
            disabled: disabled || draft.trim().length === 0,
          }, replacing === null ? t('add') : t('save')),
          replacing === null ? null : React.createElement('button', {
            type: 'button',
            style: styles.button,
            disabled,
            onClick: () => { setReplacing(null); setDraft(''); setNotice(''); setError('') },
          }, t('cancel')),
        )

      return React.createElement('div', { style: styles.root },
        React.createElement('h4', { style: styles.heading }, t('title')),
        React.createElement('p', { style: styles.hint }, t('description')),
        entries === null
          ? React.createElement('p', { style: styles.hint }, t('loading'))
          : React.createElement(React.Fragment, null,
            React.createElement('p', { style: styles.hint }, configured.length === 0
              ? t('keyless')
              : t('keysConfigured', { count: configured.length, total: refs.length })),
            rows.length > 0 ? React.createElement('div', { style: styles.list }, rows) : null,
            form,
            React.createElement('p', { style: styles.hint }, t('rotation')),
            error.length > 0
              ? React.createElement('p', { role: 'status', style: styles.error }, error,
                ' ',
                React.createElement('button', {
                  type: 'button', style: styles.button, onClick: () => { void refresh() },
                }, t('retry')))
              : notice.length > 0
                ? React.createElement('p', { role: 'status', style: styles.hint }, notice)
                : null,
          ),
      )
    }

    /** Readable message from a thrown value, never a raw object dump. */
    function messageOf(value) {
      if (value instanceof Error) return value.message
      if (typeof value === 'string') return value
      return 'unknown error'
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
          inject: () => ({ credentials: ctx.remote.credentials, refs: KEY_REFS }),
        }, TavilyConfigCard))
      },
    }
  },
})
