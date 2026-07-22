const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveRoomLookup } = require('../utils/roomIdentifier');

test('uses UUID lookup for UUID-style identifiers', () => {
  const lookup = resolveRoomLookup('550e8400-e29b-41d4-a716-446655440000');
  assert.deepEqual(lookup, { column: 'id', value: '550e8400-e29b-41d4-a716-446655440000' });
});

test('uses room number lookup for numeric identifiers', () => {
  const lookup = resolveRoomLookup('101');
  assert.deepEqual(lookup, { column: 'roomNumber', value: '101' });
});

test('uses room number lookup for alphanumeric room identifiers', () => {
  const lookup = resolveRoomLookup('A101');
  assert.deepEqual(lookup, { column: 'roomNumber', value: 'A101' });
});
