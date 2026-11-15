import { useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { setUserName, useSettings } from '../../services/settings.js'
import { CetusLogo } from '../base/CetusLogo.js'
import styles from './NicknameGate.module.css'

/** 引导只看一次：填过名字或点过跳过就记下来 */
const GATE_KEY = 'cetus:nickname-gate-done'

const readDone = (): boolean => {
  try {
    return localStorage.getItem(GATE_KEY) === '1'
  } catch {
    // 存储不可用时不打扰用户
    return true
  }
}

/**
 * 首次使用的称呼引导：全屏毛玻璃卡片。
 * 已经设置过称呼的老用户不会看到。
 */
export const NicknameGate = () => {
  const t = useTranslate()
  const userName = useSettings((state) => state.userName)
  const [done, setDone] = useState(readDone)
  const [value, setValue] = useState('')

  if (done || userName.trim()) {
    return null
  }

  const finish = (name: string | null) => {
    if (name) {
      setUserName(name)
    }
    try {
      localStorage.setItem(GATE_KEY, '1')
    } catch {
      // 存储不可用时本次会话内不再弹出
    }
    setDone(true)
  }

  return (
    <div className={styles.gate} role="dialog" aria-modal="true" aria-label={t('nicknameGateTitle')}>
      <div className={styles.card}>
        <CetusLogo className={styles.logo} title="Cetus" />
        <h1 className={styles.title}>{t('nicknameGateTitle')}</h1>
        <p className={styles.description}>{t('nicknameGateDescription')}</p>
        <input
          className={styles.input}
          type="text"
          value={value}
          maxLength={24}
          enterKeyHint="done"
          spellCheck={false}
          placeholder={t('nicknameGatePlaceholder')}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              finish(value.trim() || null)
            }
          }}
        />
        <button
          type="button"
          className={styles.primary}
          disabled={!value.trim()}
          onClick={() => finish(value.trim())}
        >
          {t('nicknameGateConfirm')}
        </button>
        <button type="button" className={styles.skip} onClick={() => finish(null)}>
          {t('nicknameGateSkip')}
        </button>
      </div>
    </div>
  )
}
