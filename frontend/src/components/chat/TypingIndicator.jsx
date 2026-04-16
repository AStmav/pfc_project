import { motion } from 'framer-motion'

const AnimatedDot = motion.span

export default function TypingIndicator({ username, visible }) {
  if (!visible) {
    return null
  }
  return (
    <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-500">
      <span>{username || 'Someone'} is typing</span>
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((index) => (
          <AnimatedDot
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-slate-400"
            animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 0.9,
              repeat: Infinity,
              delay: index * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  )
}
