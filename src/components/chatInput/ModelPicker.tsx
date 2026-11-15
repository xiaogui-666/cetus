import clsx from 'clsx'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslate } from '../../i18n/index.js'
import { setModel, useSettings } from '../../services/settings.js'
import { useProviders } from '../../services/providers.js'
import { useAnchoredPosition, useDismiss } from '../base/anchored.js'
import styles from './ModelPicker.module.css'

/** 供应商没配模型时的兜底条目，避免列表与 pill 出现空值 */
const FALLBACK_MODELS = [
  {
    id: 'deepseek-flash',
    name: 'DeepSeek Flash',
    kind: 'text' as const,
    vision: true,
    thinking: true,
  },
]

/**
 * 模型选择：输入框上的 pill，点开是当前供应商的模型列表。
 * 选择存在本机设置里，作为之后所有请求（含新对话）的默认模型。
 */
export const ModelPicker = () => {
  const t = useTranslate()
  const [open, setOpen] = useState(false)

  const providers = useProviders((state) => state.providers)
  const activeId = useProviders((state) => state.activeId)
  const provider = providers.find((item) => item.id === activeId) ?? providers[0]
  const models = provider.models.length > 0 ? provider.models : FALLBACK_MODELS
  const fallback = models[0]

  const preferred = useSettings((state) => state.model)
  const currentId = preferred ?? fallback.id
  const current = models.find((model) => model.id === currentId) ?? fallback

  const { anchorRef, floatingRef, position } = useAnchoredPosition<HTMLDivElement, HTMLDivElement>(
    open,
    { side: 'top', align: 'start', offset: 8 }
  )
  useDismiss(open, [anchorRef, floatingRef], () => setOpen(false))

  const pick = (id: string) => {
    setModel(id)
    setOpen(false)
  }

  return (
    <>
      <div className={styles.root} ref={anchorRef}>
        <button
          type="button"
          className={clsx(styles.pill, open && styles.pillOpen)}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((value) => !value)}
        >
          <span className={styles.pillLabel}>{current.name}</span>
          <svg className={styles.chevron} viewBox="0 0 10 6" aria-hidden="true">
            <path
              d="M1 1l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {open
        ? createPortal(
            <div
              ref={floatingRef}
              className={styles.panel}
              style={position ?? undefined}
              role="listbox"
              aria-label={t('settingsModel')}
            >
              <div className={styles.groupLabel}>{provider.name}</div>
              {models.map((model) => (
                <button
                  key={model.id}
                  type="button"
                  role="option"
                  aria-selected={model.id === current.id}
                  className={clsx(styles.option, model.id === current.id && styles.optionActive)}
                  onClick={() => pick(model.id)}
                >
                  <span className={styles.optionName}>{model.name}</span>
                  {model.id === current.id ? (
                    <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M3.5 8.5l3 3 6-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  )
}
