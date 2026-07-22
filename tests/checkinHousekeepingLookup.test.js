const test = require('node:test');
const assert = require('node:assert/strict');

const originalEnv = { ...process.env };

function makeMockFetch(result, ok = true) {
  return async () => ({
    ok,
    headers: { get: () => 'application/json' },
    json: async () => result,
  });
}

function loadHousekeepingClient() {
  delete require.cache[require.resolve('../src/services/housekeepingClient')];
  return require('../src/services/housekeepingClient');
}

test('getRoomStatusByNumero resolves a fresh room status from housekeeping', async () => {
  process.env.HOUSEKEEPING_SERVICE_URL = 'http://localhost:4002';
  process.env.WEBHOOK_SHARED_SECRET = 'front-office-webhook-secret';

  let capturedRequest;
  global.fetch = async (url, options) => {
    capturedRequest = { url, options };
    return {
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ numero: '101', statut: 'propre', motifBlocage: null }),
    };
  };

  const { getRoomStatusByNumero } = loadHousekeepingClient();

  const result = await getRoomStatusByNumero('101');

  assert.equal(capturedRequest.options.headers['X-Webhook-Secret'], process.env.WEBHOOK_SHARED_SECRET);
  assert.equal(capturedRequest.options.headers['X-Service-Name'], 'pms-front-office');
  assert.equal(capturedRequest.options.method, 'GET');
  assert.deepEqual(result, { numero: '101', statut: 'propre', motifBlocage: null });
});

test('getRoomStatusByNumero throws when housekeeping cannot be reached', async () => {
  process.env.HOUSEKEEPING_SERVICE_URL = 'http://localhost:4002';
  global.fetch = async () => {
    throw new Error('ECONNREFUSED');
  };
  const { getRoomStatusByNumero } = loadHousekeepingClient();

  await assert.rejects(
    () => getRoomStatusByNumero('101', 'Bearer test'),
    /Impossible de joindre le service housekeeping/
  );
});

test.afterEach(() => {
  process.env = { ...originalEnv };
  delete global.fetch;
});
