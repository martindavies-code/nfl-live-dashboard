import { useEffect, useRef } from 'react'

interface UseFocusTrapOptions {
  isOpen: boolean
  onClose: () => void
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export function useFocusTrap<T extends HTMLElement = HTMLDivElement>({
  isOpen,
  onClose,
  initialFocusRef,
}: UseFocusTrapOptions) {
  const containerRef = useRef<T>(null)
  const previousActiveElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Save previously focused element to restore when closing
    previousActiveElementRef.current = document.activeElement as HTMLElement

    const container = containerRef.current
    if (!container) return

    // Focus initial element or first focusable
    const focusableSelector =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector)

    if (initialFocusRef?.current) {
      try {
        initialFocusRef.current.focus()
      } catch {
        // Ignore focus errors on detached elements
      }
    } else if (focusableElements.length > 0) {
      try {
        focusableElements[0].focus()
      } catch {
        // Ignore focus errors
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
        return
      }

      if (e.key === 'Tab') {
        const elements = container.querySelectorAll<HTMLElement>(focusableSelector)
        if (elements.length === 0) return

        const firstElement = elements[0]
        const lastElement = elements[elements.length - 1]

        if (e.shiftKey) {
          // Shift + Tab: if on first element, wrap to last
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          // Tab: if on last element, wrap to first
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      // Restore focus to triggering element for seamless keyboard workflow
      try {
        if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
          previousActiveElementRef.current.focus()
        }
      } catch {
        // Ignore focus error if trigger element was unmounted
      }
    }
  }, [isOpen, onClose, initialFocusRef])

  return containerRef
}
