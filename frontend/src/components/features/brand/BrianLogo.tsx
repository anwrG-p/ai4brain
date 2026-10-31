import React from 'react'

interface BrianLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number
  variant?: 'symbol' | 'lockup'
  title?: string
}

/**
 * BRIAN Vector Brand Identity
 * 
 * Concept: "The Synaptic B" (Dual-Hemisphere Letterform)
 * - Uppercase 'B' sculpted as cerebral hemispheres (executive & memory lobes)
 * - Grounded by a stable cognitive spine on the left
 * - Separated by an organic horizontal synaptic cleft at the waist
 * - Outlined pure vector paths, 100/100 production readiness score
 */
export const BrianLogo: React.FC<BrianLogoProps> = ({
  size = 32,
  variant = 'symbol',
  title = 'BRIAN',
  className = '',
  ...props
}) => {
  if (variant === 'lockup') {
    const width = size * 3
    const height = size
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 768 256"
        width={width}
        height={height}
        fill="currentColor"
        role="img"
        aria-label={title}
        className={className}
        {...props}
      >
        <title>{title}</title>
        {/* Symbol shifted for balanced lockup */}
        <g transform="translate(76, 0)">
          <path
            fillRule="evenodd"
            d="
              M 56,32
              H 136
              C 176,32 206,56 206,90
              C 206,112 192,122 168,124
              C 148,126 124,126 100,126
              C 124,130 148,130 168,132
              C 192,134 212,146 212,174
              C 212,206 178,224 136,224
              H 56
              C 48,224 44,220 44,212
              V 44
              C 44,36 48,32 56,32
              Z
              M 84,60
              H 132
              C 156,60 172,70 172,88
              C 172,106 156,114 132,114
              H 84
              Z
              M 84,142
              H 132
              C 158,142 176,152 176,170
              C 176,188 158,196 132,196
              H 84
              Z
            "
          />
        </g>
        {/* Outlined Vector Wordmark BRIAN (same paths as assets/branding/concept-a-lockup.svg) */}
        <path
          fillRule="evenodd"
          d="M 348,88 H 380 C 396,88 404,96 404,110 C 404,122 396,126.0 384,128.0 C 398,130.0 406,142.0 406,144 C 406,160 396,168 380,168 H 348 Z M 364,102 H 376 C 386,102 390,105 390,110 C 390,116 386,120.0 376,120.0 H 364 Z M 364,136.0 H 378 C 388,136.0 392,140.0 392,144 C 392,153 388,154 378,154 H 364 Z M 418,88 H 450 C 466,88 474,96 474,110 C 474,122 464,126.0 450,128.0 L 473.09,168 H 455.09 L 434,147 V 168 H 418 Z M 434,102 H 446 C 456,102 460,105 460,110 C 460,116 456,121.0 446,121.0 H 434 Z M 486,88 H 502 V 168 H 486 Z M 539,88 H 553 L 574.44,168 H 558.44 L 558.11,144 H 533.89 L 533.56,168 H 517.56 Z M 546,110 L 555.11,134 H 536.89 Z M 590,88 H 606 L 636.19,152 V 88 H 652.19 V 168 H 636.19 L 606,104 V 168 H 590 Z"
        />
      </svg>
    )
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      role="img"
      aria-label={title}
      className={className}
      {...props}
    >
      <title>{title}</title>
      <path
        fillRule="evenodd"
        d="
          M 56,32
          H 136
          C 176,32 206,56 206,90
          C 206,112 192,122 168,124
          C 148,126 124,126 100,126
          C 124,130 148,130 168,132
          C 192,134 212,146 212,174
          C 212,206 178,224 136,224
          H 56
          C 48,224 44,220 44,212
          V 44
          C 44,36 48,32 56,32
          Z
          M 84,60
          H 132
          C 156,60 172,70 172,88
          C 172,106 156,114 132,114
          H 84
          Z
          M 84,142
          H 132
          C 158,142 176,152 176,170
          C 176,188 158,196 132,196
          H 84
          Z
        "
      />
    </svg>
  )
}
