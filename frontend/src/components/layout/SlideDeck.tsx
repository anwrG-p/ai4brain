import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react'

export interface SlideItem {
  id: string
  title: string
  shortLabel?: string
  icon?: React.ReactNode | string
  badge?: string
}

interface SlideDeckContextValue {
  slides: SlideItem[]
  activeSlide: number
  totalSlides: number
  goToSlide: (index: number) => void
  nextSlide: () => void
  prevSlide: () => void
  registerSlide: (slide: SlideItem) => void
  unregisterSlide: (id: string) => void
}

const SlideDeckContext = createContext<SlideDeckContextValue | null>(null)

export function useSlideDeck() {
  const context = useContext(SlideDeckContext)
  if (!context) {
    throw new Error('useSlideDeck must be used within a SlideDeck')
  }
  return context
}

export interface SlideDeckProps {
  children: React.ReactNode
  className?: string
  enableWheel?: boolean
  enableKeyboard?: boolean
  enableTouch?: boolean
}

export function SlideDeck({
  children,
  className = '',
  enableWheel = true,
  enableKeyboard = true,
  enableTouch = true,
}: SlideDeckProps) {
  const [slides, setSlides] = useState<SlideItem[]>([])
  const [activeSlide, setActiveSlide] = useState(0)

  const isTransitioningRef = useRef(false)
  const activeSlideRef = useRef(0)
  activeSlideRef.current = activeSlide
  const slidesRef = useRef<SlideItem[]>([])
  slidesRef.current = slides

  const registerSlide = useCallback((slide: SlideItem) => {
    setSlides((prev) => {
      if (prev.some((s) => s.id === slide.id)) return prev
      return [...prev, slide]
    })
  }, [])

  const unregisterSlide = useCallback((id: string) => {
    setSlides((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const goToSlide = useCallback((index: number) => {
    const currentSlides = slidesRef.current
    if (index < 0 || index >= currentSlides.length) return
    if (isTransitioningRef.current && activeSlideRef.current === index) return

    isTransitioningRef.current = true
    setActiveSlide(index)
    activeSlideRef.current = index

    const targetSlide = currentSlides[index]
    if (targetSlide && typeof document !== 'undefined') {
      const el = document.getElementById(targetSlide.id)
      if (el) {
        // Offset for the sticky AppShell navigation header (80px)
        const headerOffset = 80
        const elTop = el.getBoundingClientRect().top
        const targetScrollY = elTop + (typeof window !== 'undefined' ? window.scrollY : 0) - headerOffset

        if (
          typeof window !== 'undefined' &&
          typeof window.scrollTo === 'function' &&
          !window.navigator?.userAgent?.includes('jsdom')
        ) {
          try {
            window.scrollTo({
              top: Math.max(0, targetScrollY),
              behavior: 'smooth',
            })
          } catch {
            // Fallback for older browsers
            window.scrollTo(0, Math.max(0, targetScrollY))
          }
        }
      }
    }

    // Release lock after smooth scroll animation finishes
    const timer = setTimeout(() => {
      isTransitioningRef.current = false
    }, 700)

    return () => clearTimeout(timer)
  }, [])

  const nextSlide = useCallback(() => {
    if (activeSlideRef.current < slidesRef.current.length - 1) {
      goToSlide(activeSlideRef.current + 1)
    }
  }, [goToSlide])

  const prevSlide = useCallback(() => {
    if (activeSlideRef.current > 0) {
      goToSlide(activeSlideRef.current - 1)
    }
  }, [goToSlide])

  // Mouse Wheel & Trackpad gesture slide-to-slide trigger
  useEffect(() => {
    if (!enableWheel || typeof window === 'undefined') return

    let lastWheelTime = 0

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return
      }

      // Filter out micro-scroll trackpad jitter (< 28px)
      if (Math.abs(e.deltaY) < 28) return

      const now = Date.now()
      const currentSlides = slidesRef.current
      if (currentSlides.length <= 1) return

      // Debounce window wheel ticks
      if (now - lastWheelTime < 650 || isTransitioningRef.current) {
        // Prevent continuous uncontrolled page fling while transition is running
        if (activeSlideRef.current < currentSlides.length - 1 || e.deltaY < 0) {
          e.preventDefault()
        }
        return
      }

      if (e.deltaY > 0) {
        // Scrolling Down: Trigger transition to next slide
        if (activeSlideRef.current < currentSlides.length - 1) {
          e.preventDefault()
          lastWheelTime = now
          goToSlide(activeSlideRef.current + 1)
        }
        // When on the last slide, allow normal scrolling down so user can view footer!
      } else if (e.deltaY < 0) {
        // Scrolling Up: Trigger transition to previous slide
        if (activeSlideRef.current > 0) {
          // If user scrolled down into footer, let them scroll back up to last slide naturally
          const lastSlide = currentSlides[currentSlides.length - 1]
          if (lastSlide) {
            const lastEl = document.getElementById(lastSlide.id)
            if (lastEl && lastEl.getBoundingClientRect().top < -20) {
              return
            }
          }
          e.preventDefault()
          lastWheelTime = now
          goToSlide(activeSlideRef.current - 1)
        }
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      window.removeEventListener('wheel', handleWheel)
    }
  }, [enableWheel, goToSlide])

  // Keyboard navigation (ArrowDown, ArrowUp, PageDown, PageUp, Home, End)
  useEffect(() => {
    if (!enableKeyboard || typeof window === 'undefined') return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }

      const total = slidesRef.current.length
      if (total <= 1) return

      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        if (activeSlideRef.current < total - 1) {
          e.preventDefault()
          goToSlide(activeSlideRef.current + 1)
        }
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (activeSlideRef.current > 0) {
          e.preventDefault()
          goToSlide(activeSlideRef.current - 1)
        }
      } else if (e.key === 'Home') {
        e.preventDefault()
        goToSlide(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        goToSlide(total - 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enableKeyboard, goToSlide])

  // Touch Swipe navigation for mobile & tablet
  useEffect(() => {
    if (!enableTouch || typeof window === 'undefined') return

    let touchStartY = 0
    let touchStartTime = 0

    const handleTouchStart = (e: TouchEvent) => {
      const firstTouch = e.touches[0]
      if (firstTouch && e.touches.length === 1) {
        touchStartY = firstTouch.clientY
        touchStartTime = Date.now()
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      const changedTouch = e.changedTouches[0]
      if (changedTouch && e.changedTouches.length === 1 && !isTransitioningRef.current) {
        const touchEndY = changedTouch.clientY
        const deltaY = touchStartY - touchEndY
        const timeDiff = Date.now() - touchStartTime
        const total = slidesRef.current.length

        // Decisive vertical swipe: > 50px delta within 450ms
        if (Math.abs(deltaY) > 50 && timeDiff < 450 && total > 1) {
          if (deltaY > 0 && activeSlideRef.current < total - 1) {
            goToSlide(activeSlideRef.current + 1)
          } else if (deltaY < 0 && activeSlideRef.current > 0) {
            goToSlide(activeSlideRef.current - 1)
          }
        }
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [enableTouch, goToSlide])

  // IntersectionObserver to sync slide state if scrolled via browser scrollbar
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined' || slides.length === 0) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (isTransitioningRef.current) return

        let maxRatio = 0
        let visibleIdx = -1

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio
            const idx = slidesRef.current.findIndex(
              (s) => s.id === entry.target.id,
            )
            if (idx !== -1) visibleIdx = idx
          }
        })

        if (visibleIdx !== -1 && visibleIdx !== activeSlideRef.current) {
          setActiveSlide(visibleIdx)
          activeSlideRef.current = visibleIdx
        }
      },
      {
        threshold: [0.25, 0.5, 0.75],
        rootMargin: '-80px 0px -20% 0px',
      },
    )

    slides.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [slides])

  const contextValue = useMemo<SlideDeckContextValue>(
    () => ({
      slides,
      activeSlide,
      totalSlides: slides.length,
      goToSlide,
      nextSlide,
      prevSlide,
      registerSlide,
      unregisterSlide,
    }),
    [
      slides,
      activeSlide,
      goToSlide,
      nextSlide,
      prevSlide,
      registerSlide,
      unregisterSlide,
    ],
  )

  return (
    <SlideDeckContext.Provider value={contextValue}>
      <div className={`slide-deck-container relative ${className}`}>
        {children}

        {/* Corner Slide Navigation Arrows (Replacing the Right Slide Indicator) */}
        {slides.length > 1 && (
          <>
            {/* Top-Right Corner Arrow: Previous Slide */}
            <button
              type="button"
              onClick={prevSlide}
              disabled={activeSlide === 0}
              aria-label="Previous slide"
              title="Previous slide (Arrow Up)"
              className={`fixed top-22 sm:top-24 end-4 sm:end-6 z-40 w-11 h-11 rounded-xl bg-surface/90 backdrop-blur-md border-2 border-border-strong text-ink flex items-center justify-center transition-all cursor-pointer select-none ${
                activeSlide === 0
                  ? 'opacity-0 pointer-events-none -translate-y-2'
                  : 'opacity-100 translate-y-0 shadow-doodle hover:bg-brand hover:text-brand-ink hover:scale-105 active:scale-95'
              }`}
            >
              <span aria-hidden="true" className="font-bold text-sm">▲</span>
              <span className="sr-only">Previous slide</span>
            </button>

            {/* Bottom-Right Corner Arrow: Next Slide */}
            <button
              type="button"
              onClick={nextSlide}
              disabled={activeSlide === slides.length - 1}
              aria-label="Next slide"
              title="Next slide (Arrow Down)"
              className={`fixed bottom-20 md:bottom-6 end-4 sm:end-6 z-40 w-11 h-11 rounded-xl bg-surface/90 backdrop-blur-md border-2 border-border-strong text-ink flex items-center justify-center transition-all cursor-pointer select-none ${
                activeSlide === slides.length - 1
                  ? 'opacity-0 pointer-events-none translate-y-2'
                  : 'opacity-100 translate-y-0 shadow-doodle hover:bg-brand hover:text-brand-ink hover:scale-105 active:scale-95'
              }`}
            >
              <span aria-hidden="true" className="font-bold text-sm">▼</span>
              <span className="sr-only">Next slide</span>
            </button>
          </>
        )}
      </div>
    </SlideDeckContext.Provider>
  )
}

export interface SlideProps {
  id: string
  title: string
  shortLabel?: string
  icon?: React.ReactNode | string
  badge?: string
  className?: string
  style?: React.CSSProperties
  showNextPrompt?: boolean
  nextPromptLabel?: string
  children: React.ReactNode
}

export function Slide({
  id,
  title,
  shortLabel,
  icon,
  badge,
  className = '',
  style,
  showNextPrompt = false,
  nextPromptLabel,
  children,
}: SlideProps) {
  const { slides, activeSlide, goToSlide, nextSlide, registerSlide, unregisterSlide } =
    useSlideDeck()

  useEffect(() => {
    registerSlide({ id, title, shortLabel, icon, badge })
    return () => unregisterSlide(id)
  }, [id, title, shortLabel, icon, badge, registerSlide, unregisterSlide])

  const myIndex = slides.findIndex((s) => s.id === id)
  const isRegistered = myIndex !== -1
  const isActive = isRegistered ? myIndex === activeSlide : true
  const isPast = isRegistered ? myIndex < activeSlide : false
  const hasNext = isRegistered ? myIndex < slides.length - 1 : false
  const nextSlideTitle = hasNext ? slides[myIndex + 1]?.title : ''

  const animClass = isActive
    ? 'slide-anim-active'
    : isPast
      ? 'slide-anim-prev'
      : 'slide-anim-next'

  return (
    <section
      id={id}
      role="region"
      aria-roledescription="slide"
      aria-label={title}
      onClick={() => {
        if (!isActive && isRegistered) {
          goToSlide(myIndex)
        }
      }}
      className={`slide-stage ${!isActive ? 'cursor-pointer' : ''} ${className}`}
      style={style}
    >
      <div className={animClass}>
        {children}

        {/* Tactile Next Slide Invitation Button */}
        {showNextPrompt && hasNext && (
          <div className="pt-6 flex justify-center">
            <button
              type="button"
              onClick={nextSlide}
              className="tactile-btn py-2 px-5 rounded-pill bg-surface text-ink hover:bg-brand-subtle border-2 border-border-strong shadow-doodle-sm font-mono text-xs font-bold inline-flex items-center gap-2 cursor-pointer transition-all"
              aria-label={`Advance to next slide: ${nextSlideTitle}`}
            >
              <span>{nextPromptLabel ?? `Next Slide: ${nextSlideTitle}`}</span>
              <span aria-hidden="true" className="text-brand">↓</span>
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
