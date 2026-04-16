import AvatarBadge from '../ui/AvatarBadge'
import { AnimatePresence, motion } from 'framer-motion'
const MotionButton = motion.button
const MotionAside = motion.aside

export default function ChatInfoPanel({
  conversation,
  onlineMap,
  currentUserId,
  showDesktop = true,
  isMobileOpen = false,
  onCloseMobile,
}) {
  if (!conversation) {
    return null
  }

  const participants = conversation.participants ?? []

  const infoHeader = (
    <div className="shrink-0 border-b border-slate-200/90 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-900">Conversation info</h3>
      <p className="mt-1 text-xs text-slate-500">
        {conversation.kind === 'group' ? 'Group chat' : 'Direct chat'}
      </p>
    </div>
  )

  const participantsHeading = (
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
      Participants ({participants.length})
    </p>
  )

  const participantsList = (
    <ul className="mt-3 space-y-2">
      {participants.map((user) => {
        const isCurrent = user.id === currentUserId
        const online = Boolean(onlineMap[user.id])
        return (
          <li
            key={user.id}
            className="flex items-center gap-3 rounded-xl border border-slate-200 p-2"
          >
            <AvatarBadge name={user.username} online={online} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {user.username} {isCurrent ? '(You)' : ''}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )

  const participantsSection = (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {participantsHeading}
      {participantsList}
    </div>
  )

  return (
    <>
      {showDesktop ? (
        <aside className="hidden h-full min-h-0 self-stretch lg:flex lg:flex-col">
          {/* Full column height so border-l runs from top to bottom (aligned with composer). */}
          <div className="flex h-full min-h-0 w-80 shrink-0 flex-col border-l border-slate-200/90 bg-white">
            {infoHeader}
            {participantsSection}
          </div>
        </aside>
      ) : null}

      <AnimatePresence>
        {isMobileOpen ? (
          <>
            <MotionButton
              type="button"
              aria-label="Close participants panel"
              className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onCloseMobile}
            />
            <MotionAside
              className="fixed right-0 top-0 z-50 flex h-full w-[85vw] max-w-sm flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl lg:hidden"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">Participants</h3>
                <button
                  type="button"
                  onClick={onCloseMobile}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600"
                >
                  Close
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {infoHeader}
                <div className="px-4 pb-4 pt-0">
                  {participantsHeading}
                  {participantsList}
                </div>
              </div>
            </MotionAside>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
