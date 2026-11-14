type CetusLogoProps = {
  /** 边长，number 视为 px；默认 64 */
  size?: number | string
  className?: string
  /** 无障碍标题：传了才对屏幕阅读器可见 */
  title?: string
}

/**
 * Cetus 品牌图标：抹香鲸剪影。
 *
 * 路径数据固定，颜色用 currentColor —— 深色主题下由 --cetus-logo-color 变量翻成浅色，
 * 一份 SVG 同时适配深浅两种主题。
 */
export const CetusLogo = ({ size = 64, className, title }: CetusLogoProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1000 1000"
    width={size}
    height={size}
    className={className}
    role={title ? 'img' : undefined}
    aria-label={title}
    aria-hidden={title ? undefined : true}
    focusable="false"
  >
    {title ? <title>{title}</title> : null}
    <path
      fill="currentColor"
      d="M 142.5 375
C 143.5 340, 168 318, 205 318.5
L 385 324
C 475 328, 535 368, 590 432
C 625 473, 655 496, 685 495
C 712 494, 741 464, 741 440
C 741 424, 718 412, 700 395
C 673 368, 664 330, 673 294
C 676 282, 684 282, 689 292
C 698 310, 712 318, 735 325
C 766 334, 781 355, 784 388
C 795 362, 818 353, 855 353
C 880 353, 893 346, 904 334
C 910 328, 916 332, 915 344
C 914 382, 885 428, 840 440
C 810 446, 794 452, 786 472
C 770 565, 725 655, 546 670
C 558 682, 572 696, 576 705
C 579 712, 573 716, 562 716
C 515 715, 465 696, 430 672
C 350 668, 260 663, 205 659
C 182 657, 174 648, 174 636
C 174 626, 182 623, 198 623
L 331 616
C 336 616, 336 613, 331 612
L 195 603
C 156 600, 138.5 582, 138.5 550
Z"
    />
  </svg>
)
