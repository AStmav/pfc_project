import { X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
const MotionDiv = motion.div

export default function ToastStack({ toasts = [], onDismiss }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-80 max-w-[90vw] flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <MotionDiv
            key={toast.id}
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className={`pointer-events-auto rounded-2xl border p-3 shadow-[var(--shadow-elevated)] ${
              toast.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm leading-snug">{toast.message}</p>
              <button
                type="button"
                onClick={() => onDismiss?.(toast.id)}
                className="rounded-lg p-1 text-current/70 transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>
          </MotionDiv>
        ))}
      </AnimatePresence>
    </div>
  )
}
