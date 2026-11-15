import { useState } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { currentApiKey } from '../../services/providers.js'
import { setUserName, useSettings } from '../../services/settings.js'
import { CetusLogo } from '../base/CetusLogo.js'
import styles from './Onboarding.module.css'

const INTRO_KEY = 'cetus:intro-done'
const NICKNAME_KEY = 'cetus:nickname-gate-done'

type Step = 'intro' | 'nickname' | 'done'

const readFlag = (key: string): boolean => {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    // 存储不可用时不打扰用户
    return true
  }
}

const writeFlag = (key: string) => {
  try {
    localStorage.setItem(key, '1')
  } catch {
    // 忽略：本次会话内仍然生效
  }
}

/** 已经有 Key 的是老用户，不再走引导 */
const initialStep = (): Step => {
  if (currentApiKey()) {
    return 'done'
  }
  if (!readFlag(INTRO_KEY)) {
    return 'intro'
  }
  if (!readFlag(NICKNAME_KEY)) {
    return 'nickname'
  }
  return 'done'
}

/**
 * 首次使用的两步引导：先介绍这个站点是什么，再问怎么称呼。
 * 两屏共用一张卡片，切换时只换内容，不会连弹两个弹窗。
 */
export const Onboarding = () => {
  const t = useTranslate()
  const userName = useSettings((state) => state.userName)
  const [step, setStep] = useState<Step>(initialStep)
  const [value, setValue] = useState('')

  if (step === 'done' || (step === 'nickname' && userName.trim())) {
    return null
  }

  const finishNickname = (name: string | null) => {
    if (name) {
      setUserName(name)
    }
    writeFlag(NICKNAME_KEY)
    setStep('done')
  }

  return (
    <div
      className={styles.gate}
      role="dialog"
      aria-modal="true"
      aria-label={step === 'intro' ? t('introTitle') : t('nicknameGateTitle')}
    >
      <div className={styles.card}>
        <CetusLogo className={styles.logo} title="Cetus" />

        {step === 'intro' ? (
          <>
            <h1 className={styles.title}>{t('introTitle')}</h1>
            <p className={styles.body}>{t('introBody')}</p>
            <button
              type="button"
              className={styles.primary}
              onClick={() => {
                writeFlag(INTRO_KEY)
                setStep('nickname')
              }}
            >
              {t('introStart')}
            </button>
          </>
        ) : (
          <>
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
                  finishNickname(value.trim() || null)
                }
              }}
            />
            <button
              type="button"
              className={styles.primary}
              disabled={!value.trim()}
              onClick={() => finishNickname(value.trim())}
            >
              {t('nicknameGateConfirm')}
            </button>
            <button type="button" className={styles.skip} onClick={() => finishNickname(null)}>
              {t('nicknameGateSkip')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
