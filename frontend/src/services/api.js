const API_PREFIX = '/api';

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, options);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error;
    }
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.', { cause: error });
  }

  if (!response.ok) {
    const data = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : null;
    throw new Error(data?.error?.message || `A solicitação falhou (HTTP ${response.status}).`);
  }

  return response;
}

export async function listDocuments(signal) {
  const response = await request('/documents', { signal });
  const body = await response.json();
  return body.data;
}

export async function uploadDocument(file) {
  const body = new FormData();
  body.append('file', file);
  const response = await request('/upload', { method: 'POST', body });
  const result = await response.json();
  return result.data;
}

export async function downloadDocument(id) {
  const response = await request(`/documents/${encodeURIComponent(id)}/download`);
  return response.blob();
}
