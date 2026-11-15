import { create } from 'zustand'

/**
 * 移动端侧边栏抽屉：顶栏菜单按钮打开，点遮罩、切换会话或开启新对话后关闭。
 * closing 用于播放收起动画：先标记 closing，动画结束后再真正卸载。
 */
export const useMobileSider = create<{ open: boolean; closing: boolean }>(() => ({
  open: false,
  closing: false,
}))

export const openMobileSider = () => useMobileSider.setState({ open: true, closing: false })

export const closeMobileSider = () =>
  useMobileSider.setState((state) => (state.open ? { open: false, closing: true } : state))

/** 收起动画结束后清掉 closing，把抽屉从 DOM 里摘掉 */
export const settleMobileSider = () => useMobileSider.setState({ closing: false })
