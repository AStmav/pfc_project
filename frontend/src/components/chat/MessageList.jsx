import { useVirtualizer } from '@tanstack/react-virtual'
import { Trash2 } from 'lucide-react'
import { useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AvatarBadge from '../ui/AvatarBadge'

const MotionLi = motion.li

/** Use virtual list for long threads to keep DOM light */
const VIRTUAL_THRESHOLD = 80

function formatTime(dateString) {
  if (!dateString) {
    return ''
  }
  return new Date(dateString).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function isOwnMessage(message, currentUserId) {
  const senderId = message?.sender?.id
  if (senderId == null || currentUserId == null) {
    return false
  }
  return String(senderId) === String(currentUserId)
}

function MessageBubble({
  message,
  own,
  canDeleteMessage,
  onDeleteMessage,
  deletingMessageId,
}) {
  return (
    <article
      className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm transition-[box-shadow,transform] duration-150 md:max-w-[70%] ${
        own
          ? 'bg-brand text-white shadow-[var(--shadow-soft)] hover:shadow-md'
          : 'border border-slate-200/90 bg-white text-gray-900 hover:border-slate-300 hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-2">
        <AvatarBadge name={message.sender?.username ?? 'Unknown'} size="sm" />
        <p className="text-xs opacity-80">{message.sender?.username ?? 'Unknown'}</p>
        {canDeleteMessage?.(message) ? (
          <button
            type="button"
            onClick={() => onDeleteMessage?.(message)}
            disabled={deletingMessageId === message.id}
            className={`ml-auto rounded-md p-1 transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${
              own ? 'text-indigo-100 hover:bg-white/15' : 'text-slate-500 hover:bg-slate-100'
            }`}
            aria-label="Delete message"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
      <p className="mt-1 text-right text-[10px] tabular-nums opacity-70">
        {formatTime(message.timestamp)}
      </p>
    </article>
  )
}

function MessageListAnimated({
  messages,
  currentUserId,
  canDeleteMessage,
  onDeleteMessage,
  deletingMessageId,
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6">
      <ul className="space-y-3">
        <AnimatePresence initial={false}>
          {messages.map((message) => {
            const own = isOwnMessage(message, currentUserId)
            return (
              <MotionLi
                key={message.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.16 }}
                className={`flex ${own ? 'justify-end' : 'justify-start'}`}
              >
                <MessageBubble
                  message={message}
                  own={own}
                  canDeleteMessage={canDeleteMessage}
                  onDeleteMessage={onDeleteMessage}
                  deletingMessageId={deletingMessageId}
                />
              </MotionLi>
            )
          })}
        </AnimatePresence>
      </ul>
    </div>
  )
}

function MessageListVirtual({
  messages,
  currentUserId,
  canDeleteMessage,
  onDeleteMessage,
  deletingMessageId,
}) {
  const parentRef = useRef(null)

  /* TanStack Virtual relies on non-memoizable refs; safe in this isolated list. */
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 10,
  })

  const virtualItems = rowVirtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      className="min-h-0 flex-1 overflow-y-auto px-3 py-4 md:px-6"
    >
      <div
        className="relative w-full"
        style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
      >
        {virtualItems.map((virtualRow) => {
          const message = messages[virtualRow.index]
          const own = isOwnMessage(message, currentUserId)
          return (
            <div
              key={message.id}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className={`flex w-full pb-3 ${own ? 'justify-end' : 'justify-start'}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <MessageBubble
                message={message}
                own={own}
                canDeleteMessage={canDeleteMessage}
                onDeleteMessage={onDeleteMessage}
                deletingMessageId={deletingMessageId}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function MessageList({
  messages,
  currentUserId,
  canDeleteMessage,
  onDeleteMessage,
  deletingMessageId,
}) {
  if (!messages.length) {
    return (
      <div className="flex min-h-[12rem] flex-1 items-center justify-center px-3 py-6 text-sm text-gray-500 md:px-6">
        No messages yet. Start the conversation.
      </div>
    )
  }

  const useVirtual = messages.length > VIRTUAL_THRESHOLD

  if (useVirtual) {
    return (
      <MessageListVirtual
        messages={messages}
        currentUserId={currentUserId}
        canDeleteMessage={canDeleteMessage}
        onDeleteMessage={onDeleteMessage}
        deletingMessageId={deletingMessageId}
      />
    )
  }

  return (
    <MessageListAnimated
      messages={messages}
      currentUserId={currentUserId}
      canDeleteMessage={canDeleteMessage}
      onDeleteMessage={onDeleteMessage}
      deletingMessageId={deletingMessageId}
    />
  )
}
