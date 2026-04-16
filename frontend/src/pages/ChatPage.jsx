import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Menu, MessageSquarePlus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
const MotionDiv = motion.div
import {
  addConversationParticipants,
  createConversation,
  deleteConversationMessage,
  getConversationMessages,
  getConversations,
  getUsers,
  sendConversationMessage,
} from '../api/chat'
import ChatHeader from '../components/chat/ChatHeader'
import ChatInfoPanel from '../components/chat/ChatInfoPanel'
import ConversationList from '../components/chat/ConversationList'
import MessageComposer from '../components/chat/MessageComposer'
import MessageList from '../components/chat/MessageList'
import TypingIndicator from '../components/chat/TypingIndicator'
import AvatarBadge from '../components/ui/AvatarBadge'
import ToastStack from '../components/ui/ToastStack'
import { decodeJwtPayload } from '../lib/jwt'
import { createChatSocket } from '../realtime/chatSocket'
import { useAuth } from '../state/useAuth'

function getConversationTitle(conversation, currentUserId) {
  if (!conversation) {
    return 'Chat'
  }
  if (conversation.kind === 'group') {
    return conversation.title || 'Group chat'
  }
  const peer = conversation.participants?.find((user) => user.id !== currentUserId)
  return peer?.username || 'Direct chat'
}

function mergeMessage(existingMessages, incomingMessage) {
  const alreadyExists = existingMessages.some(
    (message) => message.id === incomingMessage.id,
  )
  if (alreadyExists) {
    return existingMessages
  }
  return [...existingMessages, incomingMessage]
}

export default function ChatPage() {
  const { accessToken, logout, isAdmin, currentUser } = useAuth()
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [typingUser, setTypingUser] = useState('')
  const [onlineMap, setOnlineMap] = useState({})
  const [socketState, setSocketState] = useState('connecting')
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [error, setError] = useState('')
  const [createError, setCreateError] = useState('')
  const [chatSearch, setChatSearch] = useState('')
  const [showConversationPanel, setShowConversationPanel] = useState(true)
  const [isInfoOpen, setIsInfoOpen] = useState(true)
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false)
  const [creatingConversation, setCreatingConversation] = useState(false)
  const [deletingMessageId, setDeletingMessageId] = useState(null)
  const [pendingDeleteMessage, setPendingDeleteMessage] = useState(null)
  const [toasts, setToasts] = useState([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [allUsers, setAllUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [selectedParticipantIds, setSelectedParticipantIds] = useState([])
  const [showAdminMenu, setShowAdminMenu] = useState(false)
  const [showMemberDmMenu, setShowMemberDmMenu] = useState(false)
  const [memberDmSearch, setMemberDmSearch] = useState('')
  const [memberDmPeerId, setMemberDmPeerId] = useState(null)
  const [memberDmError, setMemberDmError] = useState('')
  /** create = new conversation; addToGroup = add users to an existing group (admin). */
  const [adminMenuMode, setAdminMenuMode] = useState('create')
  const [addToGroupConversationId, setAddToGroupConversationId] = useState('')
  const [createForm, setCreateForm] = useState({
    kind: 'group',
    title: '',
  })
  const socketRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const adminMenuRef = useRef(null)
  const memberDmMenuRef = useRef(null)

  const authPayload = useMemo(() => decodeJwtPayload(accessToken), [accessToken])
  // Fallback to profile id if token payload shape differs.
  const currentUserId = authPayload?.user_id ?? currentUser?.id ?? null

  function dismissToast(toastId) {
    setToasts((prev) => prev.filter((toast) => toast.id !== toastId))
  }

  function pushToast(message, type = 'success') {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, { id, message, type }])
    window.setTimeout(() => {
      dismissToast(id)
    }, 3200)
  }

  const loadConversations = useCallback(async () => {
    setLoadingConversations(true)
    setError('')
    try {
      const list = await getConversations()
      setConversations(list)
      if (list.length > 0) {
        setSelectedConversation((prev) => prev ?? list[0])
        setShowConversationPanel(false)
      }
      if (!list.length) {
        setSelectedConversation(null)
      }
    } catch (requestError) {
      setError('Failed to load conversations.')
      if (requestError.response?.status === 401) {
        logout()
      }
    } finally {
      setLoadingConversations(false)
    }
  }, [logout])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    async function loadUsers() {
      setLoadingUsers(true)
      try {
        const users = await getUsers()
        setAllUsers(users)
      } catch {
        setCreateError('Failed to load users list.')
      } finally {
        setLoadingUsers(false)
      }
    }
    loadUsers()
  }, [])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (showAdminMenu && adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
        setShowAdminMenu(false)
      }
      if (
        showMemberDmMenu &&
        memberDmMenuRef.current &&
        !memberDmMenuRef.current.contains(event.target)
      ) {
        setShowMemberDmMenu(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showAdminMenu, showMemberDmMenu])

  useEffect(() => {
    if (!showAdminMenu) {
      setAdminMenuMode('create')
      setAddToGroupConversationId('')
      setCreateError('')
    }
  }, [showAdminMenu])

  useEffect(() => {
    if (!showMemberDmMenu) {
      setMemberDmSearch('')
      setMemberDmPeerId(null)
      setMemberDmError('')
    }
  }, [showMemberDmMenu])

  useEffect(() => {
    async function loadMessages() {
      if (!selectedConversation) {
        setMessages([])
        return
      }
      setLoadingMessages(true)
      try {
        const list = await getConversationMessages(selectedConversation.id)
        setMessages(list)
      } catch {
        setMessages([])
      } finally {
        setLoadingMessages(false)
      }
    }
    loadMessages()
  }, [selectedConversation])

  useEffect(() => {
    if (!selectedConversation || !accessToken) {
      return undefined
    }

    setSocketState('connecting')
    const socket = createChatSocket({
      conversationId: selectedConversation.id,
      token: accessToken,
      onState: setSocketState,
      onEvent: (event) => {
        if (event.type === 'chat_message' && event.message) {
          setMessages((prev) => mergeMessage(prev, event.message))
        }
        if (event.type === 'typing') {
          setTypingUser(event.is_typing ? event.user?.username || '' : '')
        }
        if (event.type === 'online_status') {
          const users = Array.isArray(event.online_users) ? event.online_users : []
          const isOnline = event.status === 'online'
          setOnlineMap((prev) => {
            const next = { ...prev }
            users.forEach((user) => {
              if (user?.id) {
                next[user.id] = isOnline
              }
            })
            return next
          })
        }
      },
    })

    socketRef.current = socket
    return () => {
      socket.close()
      socketRef.current = null
      setTypingUser('')
    }
  }, [selectedConversation, accessToken])

  async function handleSendMessage(content) {
    if (!selectedConversation) {
      return
    }
    try {
      const createdMessage = await sendConversationMessage(selectedConversation.id, content)
      setMessages((prev) => mergeMessage(prev, createdMessage))
      setError('')
    } catch {
      setError('Message was not sent.')
      pushToast('Failed to send message.', 'error')
    }
  }

  async function handleDeleteMessage(message) {
    if (!selectedConversation) {
      return
    }
    setDeletingMessageId(message.id)
    try {
      await deleteConversationMessage(selectedConversation.id, message.id)
      setMessages((prev) => prev.filter((item) => item.id !== message.id))
      pushToast('Message deleted.')
    } catch {
      setError('Message was not deleted.')
      pushToast('Failed to delete message.', 'error')
    } finally {
      setDeletingMessageId(null)
      setPendingDeleteMessage(null)
    }
  }

  function handleTyping(isTyping) {
    if (!socketRef.current) {
      return
    }
    socketRef.current.send({
      type: 'typing',
      receiver: null,
      is_typing: isTyping,
    })
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.send({
          type: 'typing',
          receiver: null,
          is_typing: false,
        })
      }, 1200)
    }
  }

  async function handleMemberCreateDirect(event) {
    event.preventDefault()
    setMemberDmError('')
    if (memberDmPeerId == null) {
      setMemberDmError('Select a teammate from your group chats.')
      return
    }

    setCreatingConversation(true)
    try {
      const conversation = await createConversation({
        kind: 'direct',
        participants: [memberDmPeerId],
      })
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conversation.id)
        if (exists) {
          return prev.map((c) => (c.id === conversation.id ? conversation : c))
        }
        return [conversation, ...prev]
      })
      setSelectedConversation(conversation)
      setShowConversationPanel(false)
      setShowMemberDmMenu(false)
      setMemberDmPeerId(null)
      setMemberDmSearch('')
      pushToast('Direct chat opened.')
    } catch (requestError) {
      const payload = requestError.response?.data
      setMemberDmError(
        payload?.error || payload?.detail || 'Could not start a direct chat.',
      )
      pushToast('Could not start a direct chat.', 'error')
    } finally {
      setCreatingConversation(false)
    }
  }

  async function handleAddMembersToGroup() {
    setCreateError('')
    const convId = Number(addToGroupConversationId)
    if (!convId) {
      setCreateError('Select a group chat.')
      return
    }
    if (selectedParticipantIds.length === 0) {
      setCreateError('Choose at least one user to add.')
      return
    }

    setCreatingConversation(true)
    try {
      const updated = await addConversationParticipants(convId, selectedParticipantIds)
      setConversations((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      setSelectedConversation((prev) => (prev?.id === updated.id ? updated : prev))
      setShowConversationPanel(false)
      setShowAdminMenu(false)
      setSelectedParticipantIds([])
      setUserSearch('')
      setAddToGroupConversationId('')
      setAdminMenuMode('create')
      pushToast('Participants added to the group.')
    } catch (requestError) {
      const payload = requestError.response?.data
      setCreateError(
        payload?.error ||
          payload?.detail ||
          'Could not add participants.',
      )
      pushToast('Could not add participants.', 'error')
    } finally {
      setCreatingConversation(false)
    }
  }

  async function handleCreateConversation(event) {
    event.preventDefault()
    setCreateError('')

    if (adminMenuMode === 'addToGroup') {
      await handleAddMembersToGroup()
      return
    }

    if (selectedParticipantIds.length === 0) {
      setCreateError('Choose at least one participant.')
      return
    }
    if (createForm.kind === 'direct' && selectedParticipantIds.length !== 1) {
      setCreateError('Direct chat requires exactly one participant.')
      return
    }

    setCreatingConversation(true)
    try {
      const payload = {
        kind: createForm.kind,
        participants: selectedParticipantIds,
        title: createForm.kind === 'group' ? createForm.title : '',
      }

      const conversation = await createConversation(payload)
      setConversations((prev) => [conversation, ...prev])
      setSelectedConversation(conversation)
      setShowConversationPanel(false)
      setShowAdminMenu(false)
      setCreateForm({
        kind: 'group',
        title: '',
      })
      setSelectedParticipantIds([])
      setUserSearch('')
      pushToast('Conversation created.')
    } catch (requestError) {
      const payload = requestError.response?.data
      setCreateError(
        payload?.error ||
          payload?.detail ||
          'Unable to create conversation. Check participant ids.',
      )
      pushToast('Unable to create conversation.', 'error')
    } finally {
      setCreatingConversation(false)
    }
  }

  function toggleParticipant(userId) {
    setSelectedParticipantIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId)
      }
      if (adminMenuMode === 'create' && createForm.kind === 'direct') {
        return [userId]
      }
      return [...prev, userId]
    })
  }

  const groupConversations = useMemo(
    () => conversations.filter((c) => c.kind === 'group'),
    [conversations],
  )

  const existingMemberIds = useMemo(() => {
    if (adminMenuMode !== 'addToGroup' || !addToGroupConversationId) {
      return new Set()
    }
    const c = conversations.find((x) => x.id === Number(addToGroupConversationId))
    return new Set((c?.participants ?? []).map((p) => p.id))
  }, [adminMenuMode, addToGroupConversationId, conversations])

  const availableUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase()
    return allUsers
      .filter((user) => user.id !== currentUserId)
      .filter((user) => {
        if (!query) {
          return true
        }
        const username = String(user.username ?? '').toLowerCase()
        const email = String(user.email ?? '').toLowerCase()
        return username.includes(query) || email.includes(query)
      })
  }, [allUsers, currentUserId, userSearch])

  const pickableUsers = useMemo(() => {
    if (adminMenuMode !== 'addToGroup') {
      return availableUsers
    }
    return availableUsers.filter((u) => !existingMemberIds.has(u.id))
  }, [adminMenuMode, availableUsers, existingMemberIds])

  const memberDmCandidates = useMemo(() => {
    const q = memberDmSearch.trim().toLowerCase()
    return allUsers.filter((user) => {
      if (user.id === currentUserId) {
        return false
      }
      if (!q) {
        return true
      }
      const username = String(user.username ?? '').toLowerCase()
      const email = String(user.email ?? '').toLowerCase()
      return username.includes(q) || email.includes(q)
    })
  }, [allUsers, currentUserId, memberDmSearch])

  useEffect(() => {
    if (adminMenuMode !== 'addToGroup' || addToGroupConversationId) {
      return
    }
    if (groupConversations.length === 1) {
      setAddToGroupConversationId(String(groupConversations[0].id))
    }
  }, [adminMenuMode, addToGroupConversationId, groupConversations])

  function canDeleteMessage(message) {
    return isAdmin || message.sender?.id === currentUserId
  }

  function handleToggleInfo() {
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setIsInfoDrawerOpen(true)
      return
    }
    setIsInfoOpen((prev) => !prev)
  }

  return (
    <main className="h-screen w-full bg-surface-app">
      <div className="mx-auto flex h-full w-full max-w-6xl overflow-hidden border-x border-slate-200/90 bg-white shadow-[var(--shadow-elevated)]">
        <aside
          className={`${
            showConversationPanel ? 'flex' : 'hidden'
          } w-full flex-col border-r border-slate-200 md:flex md:w-80`}
        >
          <header className="relative border-b border-slate-200/90 bg-white px-4 py-3">
            <div className="mb-3 flex items-center gap-3">
              <AvatarBadge name={currentUser?.username || 'User'} online />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {currentUser?.username || 'User'}
                </p>
                <p className="truncate text-xs text-gray-500">{currentUser?.email}</p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">Chats</h1>
              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminMenu((prev) => !prev)
                      setShowMemberDmMenu(false)
                    }}
                    className="rounded-xl border border-slate-200/90 bg-white p-2 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 active:scale-[0.98]"
                    aria-label="Open admin menu"
                    aria-expanded={showAdminMenu}
                  >
                    <Menu className="h-5 w-5" strokeWidth={2} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMemberDmMenu((prev) => !prev)
                      setShowAdminMenu(false)
                    }}
                    className="rounded-xl border border-slate-200/90 bg-white p-2 text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 active:scale-[0.98]"
                    aria-label="New direct message"
                    aria-expanded={showMemberDmMenu}
                    title="Message someone from your group chats"
                  >
                    <MessageSquarePlus className="h-5 w-5" strokeWidth={2} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-lg px-2 py-1 text-sm text-gray-500 transition hover:bg-slate-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                >
                  Log out
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={loadConversations}
              className="mt-3 w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh list
            </button>
            <input
              type="text"
              value={chatSearch}
              onChange={(event) => setChatSearch(event.target.value)}
              placeholder="Search chats"
              className="mt-2 w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-brand focus:ring-2 focus:ring-brand/20"
            />
            <AnimatePresence>
              {!isAdmin && showMemberDmMenu ? (
                <MotionDiv
                  ref={memberDmMenuRef}
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute left-4 right-4 top-14 z-50 max-h-[min(70vh,28rem)] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[var(--shadow-elevated)]"
                >
                  <form onSubmit={handleMemberCreateDirect} className="space-y-2">
                    <p className="text-sm font-medium text-gray-900">Direct message</p>
                    <p className="text-[11px] leading-snug text-gray-500">
                      You can start a 1:1 chat with people who are in at least one{' '}
                      <strong>group</strong> with you.
                    </p>
                    <input
                      type="text"
                      value={memberDmSearch}
                      onChange={(event) => setMemberDmSearch(event.target.value)}
                      placeholder="Search by name or email"
                      className="w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                    <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200/80">
                      {loadingUsers ? (
                        <p className="px-3 py-2 text-xs text-slate-500">Loading…</p>
                      ) : memberDmCandidates.length ? (
                        <ul className="divide-y divide-slate-100">
                          {memberDmCandidates.map((user) => {
                            const selected = memberDmPeerId === user.id
                            return (
                              <li key={user.id} className="flex items-center justify-between px-3 py-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm text-slate-800">{user.username}</p>
                                  <p className="truncate text-xs text-slate-500">{user.email}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMemberDmPeerId((prev) =>
                                      prev === user.id ? null : user.id,
                                    )
                                  }
                                  className={`ml-3 rounded-lg px-2 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 active:scale-[0.98] ${
                                    selected
                                      ? 'bg-slate-200 text-slate-800'
                                      : 'bg-brand-muted text-brand hover:bg-indigo-100'
                                  }`}
                                >
                                  {selected ? 'Selected' : 'Choose'}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      ) : (
                        <p className="px-3 py-2 text-xs text-slate-500">
                          {allUsers.length === 0
                            ? 'No teammates yet — join a group chat first.'
                            : 'No users match your search.'}
                        </p>
                      )}
                    </div>
                    {memberDmError ? (
                      <p className="text-xs text-red-600">{memberDmError}</p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={creatingConversation || memberDmPeerId == null}
                      className="w-full rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                      {creatingConversation ? 'Opening…' : 'Start chat'}
                    </button>
                  </form>
                </MotionDiv>
              ) : null}
            </AnimatePresence>
            <AnimatePresence>
              {isAdmin && showAdminMenu ? (
                <MotionDiv
                  ref={adminMenuRef}
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.16 }}
                  className="absolute left-4 right-4 top-14 z-50 max-h-[min(70vh,28rem)] overflow-y-auto rounded-2xl border border-slate-200/90 bg-white p-3 shadow-[var(--shadow-elevated)]"
                >
                <form onSubmit={handleCreateConversation} className="space-y-2">
                  <div className="flex rounded-xl bg-slate-100 p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminMenuMode('create')
                        setCreateError('')
                      }}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                        adminMenuMode === 'create'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      New chat
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAdminMenuMode('addToGroup')
                        setCreateError('')
                        setSelectedParticipantIds([])
                      }}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                        adminMenuMode === 'addToGroup'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Add to group
                    </button>
                  </div>

                  {adminMenuMode === 'create' ? (
                    <>
                      <p className="text-sm font-medium text-gray-900">Create conversation</p>
                      <select
                        value={createForm.kind}
                        onChange={(event) =>
                          setCreateForm((prev) => ({
                            ...prev,
                            kind: event.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm text-gray-800 shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      >
                        <option value="group">Group</option>
                        <option value="direct">Direct</option>
                      </select>
                      {createForm.kind === 'group' ? (
                        <input
                          type="text"
                          value={createForm.title}
                          onChange={(event) =>
                            setCreateForm((prev) => ({ ...prev, title: event.target.value }))
                          }
                          placeholder="Group title (optional)"
                          className="w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                        />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-gray-900">Add people to a group</p>
                      <p className="text-[11px] leading-snug text-gray-500">
                        Direct chats stay 1:1 — only group chats accept new members here.
                      </p>
                      {groupConversations.length ? (
                        <select
                          value={addToGroupConversationId}
                          onChange={(event) => {
                            setAddToGroupConversationId(event.target.value)
                            setSelectedParticipantIds([])
                          }}
                          className="w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm text-gray-800 shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                        >
                          <option value="">Select group…</option>
                          {groupConversations.map((c) => (
                            <option key={c.id} value={String(c.id)}>
                              {getConversationTitle(c, currentUserId)} · #{c.id}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          No group chats yet. Create a group under &quot;New chat&quot; first.
                        </p>
                      )}
                    </>
                  )}

                  <input
                    type="text"
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search users by username/email"
                    className="w-full rounded-xl border border-slate-200/90 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                  />
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200/80">
                    {loadingUsers ? (
                      <p className="px-3 py-2 text-xs text-slate-500">Loading users...</p>
                    ) : pickableUsers.length ? (
                      <ul className="divide-y divide-slate-100">
                        {pickableUsers.map((user) => {
                          const selected = selectedParticipantIds.includes(user.id)
                          return (
                            <li key={user.id} className="flex items-center justify-between px-3 py-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm text-slate-800">{user.username}</p>
                                <p className="truncate text-xs text-slate-500">{user.email}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => toggleParticipant(user.id)}
                                className={`ml-3 rounded-lg px-2 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35 active:scale-[0.98] ${
                                  selected
                                    ? 'bg-slate-200 text-slate-800'
                                    : 'bg-brand-muted text-brand hover:bg-indigo-100'
                                }`}
                              >
                                {selected ? 'Remove' : 'Add'}
                              </button>
                            </li>
                          )
                        })}
                      </ul>
                    ) : (
                      <p className="px-3 py-2 text-xs text-slate-500">
                        {adminMenuMode === 'addToGroup' && addToGroupConversationId
                          ? 'Everyone is already in this group, or no users match search.'
                          : 'No users found.'}
                      </p>
                    )}
                  </div>
                  {selectedParticipantIds.length ? (
                    <p className="text-xs text-slate-600">
                      Selected IDs: {selectedParticipantIds.join(', ')}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      {adminMenuMode === 'addToGroup'
                        ? 'Pick users to add to the selected group.'
                        : 'No participants selected yet.'}
                    </p>
                  )}
                  {createError ? (
                    <p className="text-xs text-red-600">{createError}</p>
                  ) : null}
                  <button
                    type="submit"
                    disabled={
                      creatingConversation ||
                      (adminMenuMode === 'addToGroup' && !groupConversations.length)
                    }
                    className="w-full rounded-xl bg-brand px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {creatingConversation
                      ? adminMenuMode === 'addToGroup'
                        ? 'Adding…'
                        : 'Creating…'
                      : adminMenuMode === 'addToGroup'
                        ? 'Add to group'
                        : 'Create conversation'}
                  </button>
                </form>
                </MotionDiv>
              ) : null}
            </AnimatePresence>
          </header>

          <ConversationList
            conversations={conversations}
            selectedConversationId={selectedConversation?.id}
            onSelectConversation={(conversation) => {
              setSelectedConversation(conversation)
              setShowConversationPanel(false)
            }}
            loading={loadingConversations}
            currentUserId={currentUserId}
            searchQuery={chatSearch}
          />
        </aside>

        <div
          className={`${
            showConversationPanel ? 'hidden md:flex' : 'flex'
          } min-h-0 min-w-0 flex-1 items-stretch`}
        >
          <section className="flex min-h-0 min-w-0 flex-1 flex-col">
            {!selectedConversation ? (
              <div className="m-auto max-w-sm px-6 text-center">
                <p className="text-lg font-medium text-gray-900">No conversation selected.</p>
                <p className="mt-1 text-sm text-gray-500">
                  {isAdmin
                    ? 'Pick a chat from the list or create one from the menu.'
                    : 'Pick a chat from the list or start a direct message with a teammate.'}
                </p>
              </div>
            ) : (
              <>
                <ChatHeader
                  title={getConversationTitle(selectedConversation, currentUserId)}
                  socketState={socketState}
                  onBack={() => setShowConversationPanel(true)}
                  isAdmin={isAdmin}
                  participants={selectedConversation.participants}
                  onlineMap={onlineMap}
                  onToggleInfo={handleToggleInfo}
                />

                {error ? (
                  <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}

                <div className="flex min-h-0 flex-1 flex-col">
                  {loadingMessages ? (
                    <p className="px-4 py-4 text-sm text-gray-500">Loading messages...</p>
                  ) : (
                    <MessageList
                      messages={messages}
                      currentUserId={currentUserId}
                      canDeleteMessage={canDeleteMessage}
                      onDeleteMessage={setPendingDeleteMessage}
                      deletingMessageId={deletingMessageId}
                    />
                  )}
                </div>

                <TypingIndicator visible={Boolean(typingUser)} username={typingUser} />

                <MessageComposer
                  onSubmit={handleSendMessage}
                  onTyping={handleTyping}
                  disabled={!selectedConversation}
                />
              </>
            )}
          </section>
          <ChatInfoPanel
            conversation={selectedConversation}
            onlineMap={onlineMap}
            currentUserId={currentUserId}
            showDesktop={isInfoOpen}
            isMobileOpen={isInfoDrawerOpen}
            onCloseMobile={() => setIsInfoDrawerOpen(false)}
          />
        </div>
      </div>

      <AnimatePresence>
        {pendingDeleteMessage ? (
          <MotionDiv
            className="fixed inset-0 z-[65] flex items-center justify-center bg-slate-900/40 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <MotionDiv
              className="w-full max-w-sm rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[var(--shadow-elevated)]"
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.16 }}
            >
              <h3 className="text-sm font-semibold text-gray-900">Delete message?</h3>
              <p className="mt-1 text-sm text-gray-600">
                This action cannot be undone.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDeleteMessage(null)}
                  className="rounded-xl border border-slate-200/90 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/35"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteMessage(pendingDeleteMessage)}
                  className="rounded-xl bg-red-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                >
                  Delete
                </button>
              </div>
            </MotionDiv>
          </MotionDiv>
        ) : null}
      </AnimatePresence>

      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </main>
  )
}
