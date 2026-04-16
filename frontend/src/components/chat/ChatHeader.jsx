import AvatarBadge from '../ui/AvatarBadge'

export default function ChatHeader({
  title,
  socketState,
  onBack,
  isAdmin,
  participants = [],
  onlineMap = {},
  onToggleInfo,
}) {
  const statusLabel = {
    open: 'Online',
    closed: 'Offline',
    error: 'Connection error',
    connecting: 'Connecting...',
  }[socketState]

  return (
    <header className="flex items-center justify-between border-b border-slate-200/90 bg-white px-4 py-3 shadow-[var(--shadow-soft)]">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded-xl border border-slate-200/90 px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 active:scale-[0.98] md:hidden"
        >
          Back
        </button>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold tracking-tight text-gray-900">{title}</h2>
            {isAdmin ? (
              <span className="shrink-0 rounded-lg bg-brand-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand">
                Admin
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <p className="text-xs text-gray-500">{statusLabel}</p>
            <div className="hidden items-center gap-1 md:flex">
              {participants.slice(0, 3).map((user) => (
                <AvatarBadge
                  key={user.id}
                  name={user.username}
                  size="sm"
                  online={Boolean(onlineMap[user.id])}
                  className="ring-2 ring-white"
                />
              ))}
              {participants.length > 3 ? (
                <span className="text-xs text-gray-500">+{participants.length - 3}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onToggleInfo}
        className="shrink-0 rounded-xl border border-slate-200/90 px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 active:scale-[0.98]"
      >
        Participants
      </button>
    </header>
  )
}
