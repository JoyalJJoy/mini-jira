import { useEffect, useRef, useState } from 'react'

/**
 * Observes an element and returns whether it's visible in the viewport.
 * @param {object} options - IntersectionObserver options
 * @param {number} options.threshold - 0–1, default 0.1
 * @param {string} options.rootMargin - CSS margin string, default '0px 0px -50px 0px'
 * @param {boolean} options.once - Only trigger once, default true
 */
export default function useScrollReveal(options = {}) {
  const { threshold = 0.1, rootMargin = '0px 0px -50px 0px', once = true } = options
  const ref = useRef(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          if (once) observer.unobserve(el)
        } else if (!once) {
          setIsVisible(false)
        }
      },
      { threshold, rootMargin }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, rootMargin, once])

  return [ref, isVisible]
}
