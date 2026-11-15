import clsx from 'clsx'
import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
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
 *
 * 滑轨用 div + Pointer Events 自己实现（不用原生 range）：原生 range 在移动端
 * 触摸区太小拖不动，各平台 thumb 样式也难统一。这里拖动全程按比例取整，天然吸附到档位。
 * 面板挂在 body 上，因为输入框容器有 overflow: hidden，浮层放里面会被裁掉。
 */
export const ThinkingControl = () => {
  const t = useTranslate()
  const thinking = useSettings((state) => state.thinking)
  const level = useSettings((state) => state.thinkingLevel)
  const [open, setOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  const { anchorRef, floatingRef, position } = useAnchoredPosition<HTMLDivElement, HTMLDivElement>(
    open,
    { side: 'top', align: 'start', offset: 10 }
  )
  useDismiss(open, [anchorRef, floatingRef], () => setOpen(false))

  const index = THINKING_LEVELS.indexOf(level)
  const stop = thinking ? index + 1 : 0
  const percent = (stop / STOPS) * 100
  const label = thinking ? t(LEVEL_LABEL[level]) : t('thinkingOff')

  const select = (next: number) => {
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

  /** 按触点位置换算档位：四舍五入 = 吸附 */
  const pick = (clientX: number) => {
    const track = trackRef.current
    if (!track) {
      return
    }
    const rect = track.getBoundingClientRect()
    if (rect.width === 0) {
      return
    }
    const ratio = (clientX - rect.left) / rect.width
    select(ratio * STOPS)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
    pick(event.clientX)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return
    }
    pick(event.clientX)
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
    select(stop + step)
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
                <div className={styles.rail}>
                  <div
                    className={clsx(styles.fill, dragging && styles.fillDragging)}
                    style={{ width: `${percent}%` }}
                  />
                  <div className={styles.marks} aria-hidden="true">
                    {Array.from({ length: STOPS + 1 }, (_, i) => (
                      <span
                        key={i}
                        className={clsx(styles.mark, stop >= i && styles.markOn)}
                        style={{ left: `${(i / STOPS) * 100}%` }}
                      />
                    ))}
                  </div>
                  <div
                    className={clsx(styles.knob, dragging && styles.knobDragging)}
                    style={{ left: `${percent}%` }}
                  />
                </div>
              </div>

              <div className={styles.scale} aria-hidden="true">
                <span>{t('thinkingOff')}</span>
                <span>{t(LEVEL_LABEL.low)}</span>
                <span>{t(LEVEL_LABEL.medium)}</span>
                <span>{t(LEVEL_LABEL.high)}</span>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
