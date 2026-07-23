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

async function resolveSeasonId(checkInDate, authToken) {
  const url = `${process.env.TARIFICATION_SERVICE_URL}/api/seasons`;
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

    const seasons = Array.isArray(payload) ? payload : payload.seasons || payload.data || [];
    const target = new Date(checkInDate);

    const matched = seasons.find((s) => {
      const debut = new Date(s.dateDebut);
      const fin = new Date(s.dateFin);
      return target >= debut && target <= fin;
    });

    if (!matched) {
      return null;
    }

    return matched.id;
  } catch (err) {
    if (err instanceof Error) {
      const msg = (err.message || '').toString();
      const isAbortError = err.name === 'AbortError';
      const isNetworkError =
        err.name === 'FetchError' ||
        isAbortError ||
        msg.toLowerCase().includes('econnrefused') ||
        msg.toLowerCase().includes('fetch failed');

      if (isNetworkError) {
        const error = new Error(`Impossible de joindre le service tarification pour résoudre la saison: ${err.message}`);
        error.status = 502;
        throw error;
      }
      throw err;
    }

    const error = new Error('Erreur inattendue lors de la résolution de saison');
    error.status = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function calculateRate({ partnerId, category, seasonId, regime, nights }, authToken) {
  const params = new URLSearchParams({
    categorie: category,
    seasonId: String(seasonId),
    regime,
    nights: String(nights),
  });

  if (partnerId) {
    params.set('partnerId', partnerId);
  }

  const url = `${process.env.TARIFICATION_SERVICE_URL}/api/rates/calculate?${params.toString()}`;
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
      const isAbortError = err.name === 'AbortError';
      const isNetworkError =
        err.name === 'FetchError' ||
        isAbortError ||
        msg.toLowerCase().includes('econnrefused') ||
        msg.toLowerCase().includes('fetch failed');

      if (isNetworkError) {
        const error = new Error(`Impossible de joindre le service tarification: ${err.message}`);
        error.status = 502;
        throw error;
      }
      throw err;
    }

    const error = new Error('Erreur inattendue lors du calcul tarifaire');
    error.status = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  resolveSeasonId,
  calculateRate,
};
