const fetch = global.fetch;

function buildInternalServiceHeaders(authToken) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Service-Name': 'pms-front-office',
  };

  if (process.env.WEBHOOK_SHARED_SECRET) {
    headers['X-Webhook-Secret'] = process.env.WEBHOOK_SHARED_SECRET;
  }

  if (authToken) {
    headers.Authorization = authToken;
  }

  return headers;
}

async function getRoomStatusByNumero(numero, authToken) {
  if (!numero) {
    throw new Error('Numéro de chambre requis pour la récupération du statut');
  }

  const url = `${process.env.HOUSEKEEPING_SERVICE_URL}/api/rooms/numero/${encodeURIComponent(numero)}/status`;
  const headers = buildInternalServiceHeaders(authToken);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const message = typeof payload === 'object' && payload ? payload.error || payload.message : payload;
      const error = new Error(message || `Erreur HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return payload;
  } catch (err) {
    if (err instanceof Error) {
      const msg = (err.message || '').toString();
      const normalized = msg.toLowerCase();
      const isAbortError = err.name === 'AbortError';
      const isNetworkError =
        err.name === 'FetchError' ||
        isAbortError ||
        normalized.includes('econnrefused') ||
        normalized.includes('failed to fetch') ||
        normalized.includes('network') ||
        normalized.includes('fetch failed') ||
        normalized.includes('request to') ||
        err.code === 'ECONNREFUSED';

      if (isNetworkError) {
        const error = new Error(`Impossible de joindre le service housekeeping pour vérifier le statut de la chambre: ${err.message}`);
        error.status = 502;
        throw error;
      }
      throw err;
    }

    const error = new Error('Erreur inattendue lors de la récupération du statut housekeeping');
    error.status = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function updateRoomStatusByNumero(numero, statut, motifBlocage, authToken) {
  if (!numero) {
    throw new Error('Numéro de chambre requis pour la synchronisation');
  }

  const url = `${process.env.HOUSEKEEPING_SERVICE_URL}/api/rooms/numero/${encodeURIComponent(numero)}/status`;
  const headers = buildInternalServiceHeaders(authToken);

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ statut, motifBlocage: motifBlocage || null })
    });

    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
      const message = typeof payload === 'object' && payload ? payload.error || payload.message : payload;
      const error = new Error(message || `Erreur HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return payload;
  } catch (err) {
    if (err instanceof Error) {
      const msg = (err.message || '').toString();
      const isNetworkError = err.name === 'FetchError' || msg.startsWith('request to') || msg.toLowerCase().includes('fetch') || err.code === 'ECONNREFUSED';
      if (isNetworkError) {
        const error = new Error(`Impossible de joindre le service housekeeping: ${err.message}`);
        error.status = 502;
        throw error;
      }
      throw err;
    }
    const error = new Error('Erreur inattendue lors de l’appel housekeeping');
    error.status = 502;
    throw error;
  }
}

module.exports = {
  getRoomStatusByNumero,
  updateRoomStatusByNumero
};
