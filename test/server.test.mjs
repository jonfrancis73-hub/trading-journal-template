import test from 'node:test';
import assert from 'node:assert/strict';
import { corsOrigin } from '../server/index.js';

test('local API CORS only allows configured journal origins', () => {
  const previous = process.env.LOCAL_API_ALLOWED_ORIGINS;
  delete process.env.LOCAL_API_ALLOWED_ORIGINS;
  try {
    assert.equal(corsOrigin({ headers: { origin: 'http://127.0.0.1:5176' } }), 'http://127.0.0.1:5176');
    assert.equal(corsOrigin({ headers: { origin: 'http://localhost:5176' } }), 'http://localhost:5176');
    assert.equal(corsOrigin({ headers: { origin: 'http://127.0.0.1:9999' } }), 'http://127.0.0.1:5176');

    process.env.LOCAL_API_ALLOWED_ORIGINS = 'http://127.0.0.1:5300';
    assert.equal(corsOrigin({ headers: { origin: 'http://127.0.0.1:5300' } }), 'http://127.0.0.1:5300');
    assert.equal(corsOrigin({ headers: { origin: 'http://localhost:5176' } }), 'http://127.0.0.1:5176');
  } finally {
    if (previous === undefined) delete process.env.LOCAL_API_ALLOWED_ORIGINS;
    else process.env.LOCAL_API_ALLOWED_ORIGINS = previous;
  }
});
