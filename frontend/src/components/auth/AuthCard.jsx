import { motion } from 'framer-motion'

const MotionSection = motion.section
const MotionAside = motion.aside

export default function AuthCard({ title, subtitle, children, footer }) {
  return (
    <main className="min-h-screen bg-surface-app p-4 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[var(--shadow-elevated)] md:grid-cols-2">
        <MotionAside
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35 }}
          className="relative hidden flex-col justify-between bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 p-8 text-white md:flex"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.25),transparent_45%)]" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
              Chat Platform
            </p>
            <h2 className="mt-4 text-4xl font-semibold leading-tight">
              Simple and fast
              <br />
              communication
            </h2>
            <p className="mt-4 max-w-sm text-sm text-white/80">
              Secure real-time conversations for teams that need speed, clarity, and trust.
            </p>
          </div>
          <div className="relative rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur">
            <p className="text-sm text-white/90">Real-time updates</p>
            <p className="mt-1 text-xs text-white/75">
              Typing indicators, online status, and instant delivery built in.
            </p>
          </div>
        </MotionAside>

        <MotionSection
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="flex items-center justify-center bg-surface-app/70 p-5 sm:p-8"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand/80">
              Chat Platform
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
            <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            <div className="mt-6">{children}</div>
            {footer ? <div className="mt-5">{footer}</div> : null}
          </div>
        </MotionSection>
      </div>
    </main>
  )
}
