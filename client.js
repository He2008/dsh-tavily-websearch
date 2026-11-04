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
        description: 'Add one or more Tavily keys to use your account limits. Keys are stored in the DSH credential store and never shown again.',
        loading: 'Reading configured keys…',
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
        placeholder: 'Paste a Tavily key, e.g. tvly-…',
        rotation: 'Searches rotate across keys; a rejected or rate-limited key is skipped. If every key fails, keyless mode is used when enabled.',
        envManaged: 'This key comes from the environment; delete the variable instead.',
        saved: 'Key saved.',
        removed: 'Key removed.',
        saveFailed: 'Could not save the key: {error}',
        removeFailed: 'Could not delete the key: {error}',
        loadFailed: 'Could not read the configured keys: {error}',
        retry: 'Retry',
      },
      zh: {
        title: 'Tavily API Key',
        description: '添加一个或多个 Tavily Key 以使用账户额度。Key 保存在 DSH 凭据库中，保存后不再显示。',
        loading: '正在读取已配置的 Key…',
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
        placeholder: '粘贴 Tavily Key，例如 tvly-…',
        rotation: '搜索会在多个 Key 之间轮换，被拒绝或限流的 Key 会被跳过。全部失败时，如已启用则回退到免密钥模式。',
        envManaged: '该 Key 来自环境变量，请删除对应的环境变量。',
        saved: 'Key 已保存。',
        removed: 'Key 已删除。',
        saveFailed: '保存失败：{error}',
        removeFailed: '删除失败：{error}',
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
      success: 'var(--dsw-alias-state-success-primary, #15803d)',
      accent: 'var(--dsw-alias-brand-primary, #2563eb)',
    }

    const styles = {
      root: { display: 'flex', flexDirection: 'column', gap: '8px', color: color.text, fontSize: '13px' },
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
      badgeOn: {
        padding: '1px 6px', borderRadius: '4px', background: color.raised,
        color: color.success, fontSize: '11px', lineHeight: '16px', whiteSpace: 'nowrap',
      },
      source: { color: color.muted, fontSize: '11px', whiteSpace: 'nowrap' },
      spacer: { flex: 1 },
      editor: { display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' },
      editorRow: { display: 'flex', alignItems: 'center', gap: '8px' },
      input: {
        flex: 1, minWidth: 0, padding: '6px 8px', font: 'inherit', color: color.text,
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

    /**
     * Bundle page card: list every key slot with its configuration state, and
     * add, replace, or delete keys through the credential Remote namespace.
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
      const [editing, setEditing] = React.useState(null)
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

      const submit = async (event) => {
        event.preventDefault()
        const value = draft.trim()
        if (editing === null || value.length === 0) return
        setSaving(true)
        setError('')
        setNotice('')
        try {
          await credentials.set(editing, value)
          setDraft('')
          setEditing(null)
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
          if (editing === reference) cancelEdit()
          setNotice(t('removed'))
          await refresh()
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
        return React.createElement('div', { key: reference, style: styles.row },
          React.createElement('span', { style: styles.keyLabel }, t('keyLabel', { index: index + 1 })),
          React.createElement('code', { style: styles.reference }, reference),
          React.createElement('span', { style: isConfigured ? styles.badgeOn : styles.badge },
            isConfigured ? t('configured') : t('empty')),
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

      const editor = editing === null ? null : React.createElement('form', { style: styles.editor, onSubmit: submit },
        React.createElement('p', { style: styles.hint },
          t('editing', { index: refs.indexOf(editing) + 1, reference: editing })),
        React.createElement('div', { style: styles.editorRow },
          React.createElement('input', {
            id: inputId,
            type: 'password',
            style: styles.input,
            value: draft,
            placeholder: t('placeholder'),
            'aria-label': t('keyLabel', { index: refs.indexOf(editing) + 1 }),
            autoComplete: 'off',
            spellCheck: false,
            disabled,
            onChange: event => setDraft(event.target.value),
          }),
          React.createElement('button', {
            type: 'submit',
            style: draft.trim().length === 0 || disabled ? { ...styles.primary, ...styles.disabled } : styles.primary,
            disabled: disabled || draft.trim().length === 0,
          }, t('save')),
          React.createElement('button', {
            type: 'button',
            style: styles.button,
            disabled,
            onClick: cancelEdit,
          }, t('cancel')),
        ),
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
            React.createElement('div', { style: styles.list }, rows),
            editor,
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
