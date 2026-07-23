const fetch = global.fetch;

function buildInternalHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'X-Internal-Secret': process.env.INTERNAL_SERVICE_SECRET || '',
  };

  return headers;
}

async function getBookingById(bookingId) {
  if (!bookingId) {
    throw new Error('ID de réservation requis');
  }

  const url = `${process.env.RESERVATIONS_SERVICE_URL}/api/internal/bookings/${encodeURIComponent(bookingId)}`;
  const headers = buildInternalHeaders();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

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
        msg.toLowerCase().includes('fetch failed') ||
        err.code === 'ECONNREFUSED';

      if (isNetworkError) {
        const error = new Error(`Impossible de joindre le service réservations: ${err.message}`);
        error.status = 502;
        throw error;
      }
      throw err;
    }

    const error = new Error('Erreur inattendue lors de la récupération de la réservation');
    error.status = 502;
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function updateBookingStatus(bookingId, status) {
  if (!bookingId) {
    throw new Error('ID de réservation requis');
  }

  const url = `${process.env.RESERVATIONS_SERVICE_URL}/api/internal/bookings/${encodeURIComponent(bookingId)}/status`;
  const headers = buildInternalHeaders();

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status }),
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
        const error = new Error(`Impossible de joindre le service réservations: ${err.message}`);
        error.status = 502;
        throw error;
      }
      throw err;
    }
    const error = new Error('Erreur inattendue lors de la mise à jour du statut');
    error.status = 502;
    throw error;
  }
}

async function updateBookingFields(bookingId, fields) {
  if (!bookingId) {
    throw new Error('ID de réservation requis');
  }

  const url = `${process.env.RESERVATIONS_SERVICE_URL}/api/internal/bookings/${encodeURIComponent(bookingId)}`;
  const headers = buildInternalHeaders();

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(fields),
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
        const error = new Error(`Impossible de joindre le service réservations: ${err.message}`);
        error.status = 502;
        throw error;
      }
      throw err;
    }
    const error = new Error('Erreur inattendue lors de la mise à jour de la réservation');
    error.status = 502;
    throw error;
  }
}

module.exports = {
  getBookingById,
  updateBookingStatus,
  updateBookingFields,
};
