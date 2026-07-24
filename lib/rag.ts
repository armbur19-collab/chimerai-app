// @chimerai component=RagLib version=1.0
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8002';

async function aiServiceFetch(endpoint: string, options?: RequestInit) {
  const res = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'AI Service error' }));
    throw new Error(err.detail || `AI Service error: ${res.status}`);
  }
  return res.json();
}

export async function addDocuments(documents: string[], metadatas?: Record<string, any>[]) {
  return aiServiceFetch('/api/rag/documents', {
    method: 'POST',
    body: JSON.stringify({ documents, metadatas }),
  });
}

export async function searchDocuments(query: string, k: number = 4) {
  return aiServiceFetch('/api/rag/search', {
    method: 'POST',
    body: JSON.stringify({ query, k }),
  });
}

export async function ragChat(query: string, model: string = 'gpt-3.5-turbo', k: number = 3) {
  return aiServiceFetch('/api/rag/chat', {
    method: 'POST',
    body: JSON.stringify({ query, model, k }),
  });
}

export async function getVectorStats() {
  return aiServiceFetch('/api/rag/stats', { method: 'GET' });
}

export async function clearVectorStore() {
  return aiServiceFetch('/api/rag/clear', { method: 'DELETE' });
}

export async function deleteDocuments(documentIds: number[]) {
  return aiServiceFetch('/api/rag/delete', {
    method: 'DELETE',
    body: JSON.stringify({ document_ids: documentIds }),
  });
}
