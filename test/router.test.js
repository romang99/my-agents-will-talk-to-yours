import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchRoute } from '../server/router.js';

// deliberately declared with the :param route FIRST — the matcher must still
// prefer the literal route, so reordering the table cannot change behaviour
const routes = {
  'POST /api/researchers/:id': () => 'update',
  'POST /api/researchers/scout': () => 'scout',
  'POST /api/researchers': () => 'create',
  'GET /api/runs/:id': () => 'run',
  'GET /api/baseline/:a/:b': () => 'baseline',
};

const run = (method, path) => {
  const m = matchRoute(routes, method, path);
  return m && { result: m.handler(), params: m.params, route: m.route };
};

test('a literal segment beats a :param regardless of declaration order', () => {
  assert.equal(run('POST', '/api/researchers/scout').result, 'scout');
  assert.equal(run('POST', '/api/researchers/synthetic-callum-reid').result, 'update');
});

test('params are captured and URL-decoded', () => {
  assert.deepEqual(run('GET', '/api/baseline/a-one/b%20two').params, { a: 'a-one', b: 'b two' });
  assert.deepEqual(run('GET', '/api/runs/run-2026-07-24').params, { id: 'run-2026-07-24' });
});

test('method and segment count must both match', () => {
  assert.equal(run('GET', '/api/researchers/scout'), null, 'wrong method');
  assert.equal(run('POST', '/api/researchers/a/b'), null, 'too many segments');
  assert.equal(run('POST', '/api/nope'), null, 'unknown path');
});

test('the matched declaration is reported, so a request can be traced to its route', () => {
  assert.equal(run('POST', '/api/researchers/scout').route, 'POST /api/researchers/scout');
  assert.equal(run('POST', '/api/researchers/x').route, 'POST /api/researchers/:id');
});
