import clsx from 'clsx'
import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useTranslate } from '../../i18n/index.js'
import {
  setThinking,
  setThinkingLevel,
  THINKING_LEVELS,
  useSettings,
} from '../../services/settings.js'
import { useAnchoredPosition, useDismiss } from '../base/anchored.js'
import { IconThinkOutline14 } from '../base/icons.js'
import styles from './ThinkingControl.module.css'

const LEVEL_LABEL = {
  low: 'thinkingLevelLow',
  medium: 'thinkingLevelMedium',
  high: 'thinkingLevelHigh',
} as const

/** 滑块档位：0 关闭，1..n 依次对应 THINKING_LEVELS */
const STOPS = THINKING_LEVELS.length

/**
 * 深度思考强度：输入框下方一个 pill，点开是浮层面板。
 * 滑块第 0 档即关闭思考，往右逐级提高强度 —— 一个控件同时管开关和强度。
 * 面板挂在 body 上（输入框容器有 overflow: hidden，浮层放里面会被裁掉）。
 */
export const ThinkingControl = () => {
  const t = useTranslate()
  const thinking = useSettings((state) => state.thinking)
  const level = useSettings((state) => state.thinkingLevel)
  const [open, setOpen] = useState(false)

  const { anchorRef, floatingRef, position } = useAnchoredPosition<HTMLDivElement, HTMLDivElement>(
    open,
    { side: 'top', align: 'start', offset: 10 }
  )
  useDismiss(open, [anchorRef, floatingRef], () => setOpen(false))

  const index = THINKING_LEVELS.indexOf(level)
  const stop = thinking ? index + 1 : 0
  const label = thinking ? t(LEVEL_LABEL[level]) : t('thinkingOff')

  const select = (next: number) => {
    if (next <= 0) {
      setThinking(false)
      return
    }
    const target = THINKING_LEVELS[Math.min(next, STOPS) - 1]
    if (target) {
      setThinking(true)
      setThinkingLevel(target)
    }
  }

  return (
    <>
      <div className={styles.root} ref={anchorRef}>
        <button
          type="button"
          className={clsx(styles.pill, thinking && styles.active, open && styles.pillOpen)}
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
        >
          <IconThinkOutline14 />
          <span className={styles.pillLabel}>{label}</span>
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
              role="dialog"
              aria-label={t('thinkingStrengthTitle')}
            >
              <div className={styles.head}>
                <span className={clsx(styles.bolt, thinking && styles.boltOn)}>
                  <IconThinkOutline14 />
                </span>
                <span className={styles.levelBig}>{label}</span>
              </div>

              <div className={styles.sliderWrap}>
                <input
                  className={styles.slider}
                  type="range"
                  min={0}
                  max={STOPS}
                  step={1}
                  value={stop}
                  aria-label={t('thinkingStrengthTitle')}
                  aria-valuetext={label}
                  style={{ '--fill': `${(stop / STOPS) * 100}%` } as CSSProperties}
                  onChange={(event) => select(Number(event.target.value))}
                />
                <div className={styles.ticks} aria-hidden="true">
                  {Array.from({ length: STOPS + 1 }, (_, v) => (
                    <span key={v} className={clsx(styles.tick, stop >= v && styles.tickOn)} />
                  ))}
                </div>
              </div>

              <div className={styles.scale} aria-hidden="true">
                <span>{t('thinkingOff')}</span>
                <span>{t(LEVEL_LABEL.high)}</span>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
