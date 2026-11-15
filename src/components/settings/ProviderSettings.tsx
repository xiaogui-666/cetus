import clsx from 'clsx'
import { useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { fetchModels } from '../../services/api/client.js'
import {
  setActiveProvider,
  setProviders,
  updateProvider,
  useProviders,
  type ModelConfig,
  type Provider,
} from '../../services/providers.js'
import { Button } from '../base/Button.js'
import { IconCheckOutline16, IconEditOutline16 } from '../base/icons.js'
import { Modal } from '../base/Modal.js'
import styles from './ProviderSettings.module.css'

/** 拉回的模型 id 与本地配置合并：已有的保留自定义字段，缺的补默认值 */
const mergeModels = (current: ModelConfig[], ids: string[]): ModelConfig[] => {
  const existing = new Map(current.map((model) => [model.id, model]))
  return ids.map(
    (id) => existing.get(id) ?? { id, name: id, kind: 'text', vision: false, thinking: false }
  )
}

/**
 * 供应商管理：列表切换 + 编辑弹窗（地址、Key、拉取模型、逐项改能力）。
 * 只有当前选中的供应商会用于发请求。
 */
export const ProviderSettings = () => {
  const t = useTranslate()
  const providers = useProviders((state) => state.providers)
  const activeId = useProviders((state) => state.activeId)
  const [editing, setEditing] = useState<{ id: string | null } | null>(null)

  const current = providers.find((provider) => provider.id === editing?.id)

  return (
    <>
      <div className={styles.list}>
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={clsx(styles.row, provider.id === activeId && styles.rowActive)}
          >
            <button
              type="button"
              className={styles.rowMain}
              aria-pressed={provider.id === activeId}
              onClick={() => setActiveProvider(provider.id)}
            >
              <span className={styles.radio}>
                {provider.id === activeId ? <IconCheckOutline16 /> : null}
              </span>
              <span className={styles.rowText}>
                <span className={styles.rowName}>{provider.name}</span>
                <span className={styles.rowMeta}>
                  {provider.baseUrl || '—'} · {provider.models.length} 个模型
                </span>
              </span>
            </button>
            <button
              type="button"
              className={styles.editBtn}
              aria-label={t('providerEdit')}
              onClick={() => setEditing({ id: provider.id })}
            >
              <IconEditOutline16 />
            </button>
          </div>
        ))}
      </div>

      <button type="button" className={styles.addBtn} onClick={() => setEditing({ id: null })}>
        {t('providerAdd')}
      </button>

      {editing ? (
        <ProviderEditor
          provider={current}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  )
}

const ProviderEditor = ({
  provider,
  onClose,
}: {
  provider?: Provider
  onClose: () => void
}) => {
  const t = useTranslate()
  const [name, setName] = useState(provider?.name ?? '')
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '')
  const [apiKey, setApiKey] = useState(provider?.apiKey ?? '')
  const [models, setModels] = useState<ModelConfig[]>(provider?.models ?? [])
  const [pulling, setPulling] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const pull = async () => {
    if (!baseUrl.trim() || !apiKey.trim() || pulling) {
      return
    }
    setPulling(true)
    setMessage(null)
    try {
      const ids = await fetchModels(baseUrl, apiKey)
      if (ids.length === 0) {
        setMessage(t('providerPullEmpty'))
      } else {
        setModels((prev) => mergeModels(prev, ids))
        setMessage(t('providerPulled', { count: ids.length }))
      }
    } catch {
      setMessage(t('providerPullFailed'))
    } finally {
      setPulling(false)
    }
  }

  const patchModel = (id: string, patch: Partial<ModelConfig>) => {
    setModels((prev) =>
      prev.map((model) => (model.id === id ? { ...model, ...patch } : model))
    )
  }

  const save = () => {
    const trimmedName = name.trim() || t('providerUntitled')
    if (provider) {
      updateProvider(provider.id, {
        name: trimmedName,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        models,
      })
    } else {
      const next: Provider = {
        id: `p-${Date.now().toString(36)}`,
        name: trimmedName,
        baseUrl: baseUrl.trim(),
        apiKey: apiKey.trim(),
        models,
      }
      setProviders([...useProviders.getState().providers, next], next.id)
    }
    onClose()
  }

  return (
    <Modal
      title={provider ? t('providerEdit') : t('providerAdd')}
      onClose={onClose}
      footer={
        <div className={styles.footer}>
          <Button variant="outlined" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={save} disabled={!baseUrl.trim()}>
            {t('save')}
          </Button>
        </div>
      }
    >
      <div className={styles.field}>
        <label className={styles.label} htmlFor="provider-name">
          {t('providerName')}
        </label>
        <input
          id="provider-name"
          className={styles.input}
          value={name}
          placeholder={t('providerNamePlaceholder')}
          onChange={(event) => setName(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="provider-base">
          {t('providerBaseUrl')}
        </label>
        <input
          id="provider-base"
          className={styles.input}
          value={baseUrl}
          spellCheck={false}
          placeholder="https://api.deepseek.com"
          onChange={(event) => setBaseUrl(event.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="provider-key">
          {t('providerApiKey')}
        </label>
        <input
          id="provider-key"
          className={styles.input}
          type="password"
          value={apiKey}
          autoComplete="off"
          spellCheck={false}
          placeholder="sk-..."
          onChange={(event) => setApiKey(event.target.value)}
        />
      </div>

      <div className={styles.modelsHead}>
        <span className={styles.label}>{t('providerModels')}</span>
        <button
          type="button"
          className={styles.pullBtn}
          disabled={pulling || !baseUrl.trim() || !apiKey.trim()}
          onClick={() => void pull()}
        >
          {pulling ? t('providerPulling') : t('providerPullModels')}
        </button>
      </div>

      {message ? <div className={styles.message}>{message}</div> : null}

      {models.length === 0 ? (
        <div className={styles.empty}>{t('providerNoModels')}</div>
      ) : (
        <div className={styles.modelList}>
          {models.map((model) => (
            <div key={model.id} className={styles.modelRow}>
              <div className={styles.modelTop}>
                <input
                  className={styles.modelName}
                  value={model.name}
                  aria-label={t('providerModelName')}
                  onChange={(event) => patchModel(model.id, { name: event.target.value })}
                />
                <select
                  className={styles.modelKind}
                  value={model.kind}
                  aria-label={t('providerModelKind')}
                  onChange={(event) =>
                    patchModel(model.id, {
                      kind: event.target.value === 'image' ? 'image' : 'text',
                    })
                  }
                >
                  <option value="text">{t('providerKindText')}</option>
                  <option value="image">{t('providerKindImage')}</option>
                </select>
              </div>
              <div className={styles.modelBottom}>
                <code className={styles.modelId}>{model.id}</code>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={model.vision}
                    onChange={(event) => patchModel(model.id, { vision: event.target.checked })}
                  />
                  {t('providerVision')}
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={model.thinking}
                    onChange={(event) => patchModel(model.id, { thinking: event.target.checked })}
                  />
                  {t('providerThinking')}
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  )
}
