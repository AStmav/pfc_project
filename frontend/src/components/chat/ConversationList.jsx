import AvatarBadge from '../ui/AvatarBadge'
import { motion } from 'framer-motion'
const MotionLi = motion.li

function getConversationTitle(conversation, currentUserId) {
  if (conversation.kind === 'group') {
    return conversation.title || 'Group chat'
  }
  const fallback = conversation.participants?.find((user) => user.id !== currentUserId)
  return fallback?.username ?? 'Direct chat'
}

export default function ConversationList({
  conversations,
  selectedConversationId,
  onSelectConversation,
  loading,
  currentUserId,
  searchQuery = '',
}) {
  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="animate-pulse rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm"
          >
            <div className="h-3 w-32 rounded bg-slate-200" />
            <div className="mt-2 h-2 w-20 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    )
  }

  if (!conversations.length) {
    return <p className="p-4 text-sm text-gray-500">No conversations yet.</p>
  }

  const filteredConversations = conversations.filter((conversation) => {
    const title = getConversationTitle(conversation, currentUserId).toLowerCase()
    return title.includes(searchQuery.trim().toLowerCase())
  })

  if (!filteredConversations.length) {
    return <p className="p-4 text-sm text-gray-500">No conversations found.</p>
  }

  return (
    <ul className="divide-y divide-slate-200/80">
      {filteredConversations.map((conversation) => {
        const isSelected = conversation.id === selectedConversationId
        const conversationTitle = getConversationTitle(conversation, currentUserId)
        return (
          <MotionLi
            key={conversation.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              onClick={() => onSelectConversation(conversation)}
              className={`w-full px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/35 ${
                isSelected
                  ? 'bg-brand-muted/60'
                  : 'hover:bg-slate-50 active:bg-slate-100/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <AvatarBadge name={conversationTitle} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{conversationTitle}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-gray-500">
                    {conversation.kind}
                  </p>
                </div>
              </div>
            </button>
          </MotionLi>
        )
      })}
    </ul>
  )
}
