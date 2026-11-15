import clsx from 'clsx'
import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { useTranslate } from '../../i18n/index.js'
import {
  setModel,
  setThinking,
  setThinkingLevel,
  THINKING_LEVELS,
  useSettings,
} from '../../services/settings.js'
import { useProviders } from '../../services/providers.js'
import { useAnchoredPosition, useDismiss } from '../base/anchored.js'
import { IconThinkOutline14 } from '../base/icons.js'
import styles from './ModelThinkingControl.module.css'

const LEVEL_LABEL = {
  low: 'thinkingLevelLow',
  medium: 'thinkingLevelMedium',
  high: 'thinkingLevelHigh',
} as const

/** 滑块档位：0 = 关闭，1..n 对应 THINKING_LEVELS */
const STOPS = THINKING_LEVELS.length

/** 供应商没配模型时的兜底条目 */
const FALLBACK_MODELS = [
  { id: 'deepseek-flash', name: 'DeepSeek Flash', kind: 'text' as const, vision: true, thinking: true },
]

/**
 * 模型 + 思考强度的合并控件。
 *
 * pill 上同时显示当前模型和强度，点开是先看强度、再切模型的两屏浮层：
 * 第一屏调强度（滑块），点中间的模型名进入第二屏选模型。两块内容共享一个面板，
 * 所以切换时高度变化不会跳位置。
 */
export const ModelThinkingControl = () => {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'thinking' | 'models'>('thinking')
  const [dragging, setDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  const providers = useProviders((state) => state.providers)
  const activeId = useProviders((state) => state.activeId)
  const provider = providers.find((item) => item.id === activeId) ?? providers[0]
  const models = provider.models.length > 0 ? provider.models : FALLBACK_MODELS

  const thinking = useSettings((state) => state.thinking)
  const level = useSettings((state) => state.thinkingLevel)
  const preferred = useSettings((state) => state.model)

  const currentModel = models.find((model) => model.id === preferred) ?? models[0]
  const index = THINKING_LEVELS.indexOf(level)
  const stop = thinking ? index + 1 : 0
  const percent = (stop / STOPS) * 100
  const label = thinking ? t(LEVEL_LABEL[level]) : t('thinkingOff')

  const { anchorRef, floatingRef, position } = useAnchoredPosition<HTMLDivElement, HTMLDivElement>(
    open,
    { side: 'top', align: 'start', offset: 10 }
  )
  useDismiss(open, [anchorRef, floatingRef], () => setOpen(false))

  // 收起后回到第一屏，下次打开先看强度
  useEffect(() => {
    if (!open) {
      setView('thinking')
    }
  }, [open])

  const selectStop = (next: number) => {
    const clamped = Math.max(0, Math.min(STOPS, Math.round(next)))
    if (clamped === 0) {
      setThinking(false)
      return
    }
    const target = THINKING_LEVELS[clamped - 1]
    if (target) {
      setThinking(true)
      setThinkingLevel(target)
    }
  }

  /** 按触点位置换算档位，四舍五入即吸附 */
  const pick = (clientX: number) => {
    const track = trackRef.current
    if (!track) {
      return
    }
    const rect = track.getBoundingClientRect()
    if (rect.width === 0) {
      return
    }
    selectStop(((clientX - rect.left) / rect.width) * STOPS)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    pick(event.clientX)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      pick(event.clientX)
    }
  }

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setDragging(false)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : 0
    if (step === 0) {
      return
    }
    event.preventDefault()
    selectStop(stop + step)
  }

  return (
    <div className={styles.root} ref={anchorRef}>
      <button
        type="button"
        className={clsx(styles.pill, thinking && styles.pillActive, open && styles.pillOpen)}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
      >
        <IconThinkOutline14 />
        <span className={styles.pillModel}>{currentModel.name}</span>
        <span className={styles.pillDot} aria-hidden="true">
          ·
        </span>
        <span className={styles.pillLevel}>{label}</span>
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

      {open
        ? createPortal(
            <div
              ref={floatingRef}
              className={styles.popover}
              // 首次测量前先隐藏，避免出现在错误的坐标上
              style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
              role="dialog"
              aria-label={t('thinkingStrengthTitle')}
            >
              {view === 'thinking' ? (
                <>
                  <div className={styles.head}>
                    <span className={clsx(styles.bolt, thinking && styles.boltOn)} aria-hidden="true">
                      <IconThinkOutline14 />
                    </span>
                    <div className={styles.center}>
                      <div className={styles.levelTitle}>{label}</div>
                      <button
                        type="button"
                        className={styles.modelSwitch}
                        onClick={() => setView('models')}
                      >
                        <span className={styles.modelSwitchName}>{currentModel.name}</span>
                        <svg viewBox="0 0 10 12" aria-hidden="true">
                          <path
                            d="M3 2l4 4-4 4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>
                    <button
                      type="button"
                      className={styles.resetBtn}
                      title={t('thinkingReset')}
                      aria-label={t('thinkingReset')}
                      onClick={() => {
                        setThinking(false)
                      }}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M3 12a9 9 0 1 0 3-6.7L3 8"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M3 3v5h5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </div>

                  <div
                    ref={trackRef}
                    className={styles.track}
                    role="slider"
                    tabIndex={0}
                    aria-label={t('thinkingStrengthTitle')}
                    aria-valuemin={0}
                    aria-valuemax={STOPS}
                    aria-valuenow={stop}
                    aria-valuetext={label}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    onKeyDown={onKeyDown}
                  >
                    <div
                      className={clsx(styles.fill, dragging && styles.fillDragging)}
                      style={{ width: `${percent}%` }}
                    />
                    <div className={styles.dots} aria-hidden="true">
                      {Array.from({ length: STOPS + 1 }, (_, i) => (
                        <span
                          key={i}
                          className={clsx(styles.dot, stop >= i && styles.dotOn)}
                        />
                      ))}
                    </div>
                    <div
                      className={clsx(styles.thumb, dragging && styles.thumbDragging)}
                      style={{ left: `${percent}%`, transform: `translateX(-${percent}%)` }}
                    />
                  </div>

                  <div className={styles.scale} aria-hidden="true">
                    <span>{t('thinkingOff')}</span>
                    <span>{t(LEVEL_LABEL.high)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className={styles.menuHead}>
                    <button
                      type="button"
                      className={styles.backBtn}
                      aria-label={t('back')}
                      onClick={() => setView('thinking')}
                    >
                      <svg viewBox="0 0 12 12" aria-hidden="true">
                        <path
                          d="M7.5 2L3.5 6l4 4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                    <span className={styles.menuTitle}>{t('settingsModel')}</span>
                    <span className={styles.menuHeadSpacer} />
                  </div>
                  <div className={styles.groupLabel}>{provider.name}</div>
                  <div className={styles.list}>
                    {models.map((model) => (
                      <button
                        key={model.id}
                        type="button"
                        role="option"
                        aria-selected={model.id === currentModel.id}
                        className={clsx(
                          styles.option,
                          model.id === currentModel.id && styles.optionActive
                        )}
                        onClick={() => {
                          setModel(model.id)
                          setView('thinking')
                        }}
                      >
                        <span className={styles.optionName}>{model.name}</span>
                        {model.id === currentModel.id ? (
                          <svg className={styles.check} viewBox="0 0 24 24" aria-hidden="true">
                            <polyline
                              points="20 6 9 17 4 12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
