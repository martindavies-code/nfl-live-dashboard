import React from 'react'
import { X, Keyboard } from 'lucide-react'
import { useFocusTrap } from '../utils/useFocusTrap'

interface KeyboardShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ShortcutItem {
  keyLabel: string
  action: string
  category: 'Navigation' | 'Controls' | 'General'
}

const SHORTCUTS: ShortcutItem[] = [
  { keyLabel: '1 - 5', action: 'Quick filter (All, Live, Red Zone, Halftime, Upcoming)', category: 'Navigation' },
  { keyLabel: '[ / ]', action: 'Previous / Next NFL Week', category: 'Navigation' },
  { keyLabel: '0 or W', action: 'Jump back to current Live Week', category: 'Navigation' },
  { keyLabel: 'P', action: 'Jump to NFL Playoffs & Super Bowl', category: 'Navigation' },
  { keyLabel: 'J / K', action: 'Cycle spotlight matchup up and down', category: 'Navigation' },
  { keyLabel: '/', action: 'Focus search bar', category: 'Navigation' },
  { keyLabel: 'R', action: 'Manual instant data refresh', category: 'Controls' },
  { keyLabel: 'S or D', action: 'Inspect 5 redundant live data sources & telemetry', category: 'Controls' },
  { keyLabel: 'A', action: 'Toggle Auto Red Zone follow', category: 'Controls' },
  { keyLabel: 'F', action: 'Toggle all 100-yard field radars (Expand / Collapse All)', category: 'Controls' },
  { keyLabel: 'M', action: 'Toggle broadcast audio effects', category: 'Controls' },
  { keyLabel: 'H', action: 'Toggle High Contrast Pro mode', category: 'Controls' },
  { keyLabel: '?', action: 'Open this keyboard shortcuts legend', category: 'General' },
  { keyLabel: 'Esc', action: 'Close dialogs or clear search query', category: 'General' },
]

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const modalRef = useFocusTrap<HTMLDivElement>({ isOpen, onClose })

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      aria-describedby="shortcuts-desc"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-lg rounded-2xl border border-white/20 bg-[#0c1220] p-6 shadow-2xl ring-1 ring-sky-500/30 text-white"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <h2 id="shortcuts-title" className="text-base font-bold text-white tracking-wide">
                Keyboard Shortcuts Legend
              </h2>
              <p id="shortcuts-desc" className="text-xs text-slate-400">
                Full hands-on keyboard control for rapid navigation & power use
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts dialog"
            className="rounded-lg p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="mt-4 space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUTS.map((sc, idx) => (
            <div
              key={`sc-${idx}`}
              className="flex items-center justify-between rounded-lg bg-white/[0.04] border border-white/[0.06] p-2.5 hover:bg-white/[0.08] transition-colors"
            >
              <span className="text-xs text-slate-300 font-medium">
                {sc.action}
              </span>
              <kbd className="inline-flex items-center gap-1 rounded bg-slate-800 border border-slate-600 px-2.5 py-1 font-mono text-xs font-bold text-sky-300 shadow-sm shrink-0">
                {sc.keyLabel}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 font-mono text-[10px] text-sky-300">Esc</kbd> anytime to dismiss</span>
          <button
            onClick={onClose}
            className="rounded-lg bg-sky-600 px-4 py-2 font-semibold text-white hover:bg-sky-500 transition-colors focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:outline-none min-h-[44px]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
