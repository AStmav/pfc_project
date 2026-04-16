import { WS_BASE_URL } from '../config'

export function createChatSocket({ conversationId, token, onEvent, onState }) {
  const socketUrl = `${WS_BASE_URL}/ws/chat/${conversationId}/?token=${token}`
  const socket = new WebSocket(socketUrl)

  socket.addEventListener('open', () => onState?.('open'))
  socket.addEventListener('close', () => onState?.('closed'))
  socket.addEventListener('error', () => onState?.('error'))
  socket.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data)
      onEvent?.(payload)
    } catch {
      onEvent?.({ type: 'error', detail: 'Invalid server payload.' })
    }
  })

  return {
    send(data) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(data))
      }
    },
    close() {
      socket.close()
    },
  }
}
