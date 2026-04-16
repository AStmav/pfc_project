import client from './client'

function normalizeConversation(conversation) {
  if (!conversation) {
    return conversation
  }
  const rawKind = String(conversation.kind ?? '')
  return {
    ...conversation,
    kind: rawKind.toLowerCase(),
  }
}

function unwrapPaginated(responseData) {
  if (Array.isArray(responseData)) {
    return responseData
  }
  if (Array.isArray(responseData?.results)) {
    return responseData.results
  }
  return []
}

export async function getConversations() {
  const response = await client.get('/conversations/')
  return unwrapPaginated(response.data).map(normalizeConversation)
}

export async function getUsers() {
  const response = await client.get('/users/')
  return unwrapPaginated(response.data)
}

export async function getConversationMessages(conversationId) {
  const response = await client.get(`/conversations/${conversationId}/messages/`)
  return unwrapPaginated(response.data)
}

export async function createConversation(payload) {
  const normalizedKind = String(payload.kind ?? '').toUpperCase()
  const response = await client.post('/conversations/', {
    ...payload,
    kind: normalizedKind,
  })
  return normalizeConversation(response.data)
}

/** Admin: add users to an existing group conversation. */
export async function addConversationParticipants(conversationId, userIds) {
  const response = await client.post(`/conversations/${conversationId}/participants/`, {
    user_ids: userIds,
  })
  return normalizeConversation(response.data)
}

export async function sendConversationMessage(conversationId, content) {
  const response = await client.post(`/conversations/${conversationId}/messages/`, {
    content,
  })
  return response.data
}

export async function deleteConversationMessage(conversationId, messageId) {
  await client.delete(`/conversations/${conversationId}/messages/${messageId}/`)
}
