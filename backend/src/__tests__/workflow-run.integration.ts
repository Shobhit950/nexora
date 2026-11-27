import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { inArray } from 'drizzle-orm';
import app from '../app';
import { db } from '../config/db';
import { users } from '../db/schema';
import type { WorkflowRunReport } from '../services/workflow-run.service';
import { executionGraph, json, startTestServer } from './workflow-run.fixtures';

function refreshCookie(response: Response) {
  const entry = response.headers.getSetCookie().find(cookie => cookie.startsWith('nexora_refresh='));
  const cookie = entry?.split(';', 1)[0];
  assert.ok(cookie && cookie.length > 'nexora_refresh='.length, 'Expected a session refresh cookie');
  return cookie;
}

test('uses PostgreSQL for saved graphs and ownership alongside existing workflow CRUD and auth', {
  timeout: 25_000,
}, async t => {
  const server = await startTestServer(app);
  const testId = randomUUID();
  const emails = [`run-owner-${testId}@example.test`, `run-other-${testId}@example.test`] as const;
  t.after(async () => {
    try {
      await server.close();
      await db.delete(users).where(inArray(users.email, [...emails]));
    } finally {
      await db.$client.end();
    }
  });

  const api = (path: string, init?: RequestInit) => fetch(`${server.url}/api${path}`, init);
  assert.equal((await api('/db-health')).status, 200, 'Integration tests require the local migrated PostgreSQL database');

  async function createUser(email: string) {
    const credentials = { email, password: randomUUID() };
    const signup = await api('/auth/signup', { method: 'POST', ...json({ ...credentials, name: 'Execution API test' }) });
    assert.equal(signup.status, 201);
    const user = await signup.json() as { id: string; email: string };
    assert.equal(user.email, email);

    const login = await api('/auth/login', { method: 'POST', ...json(credentials) });
    assert.equal(login.status, 200);
    const session = await login.json() as { id: string; accessToken: string };
    assert.equal(session.id, user.id);
    assert.ok(session.accessToken);
    return { id: user.id, token: session.accessToken, cookie: refreshCookie(login) };
  }

  const owner = await createUser(emails[0]);
  const other = await createUser(emails[1]);
  const auth = { Authorization: `Bearer ${owner.token}` };
  const me = await api('/auth/me', { headers: auth });
  assert.equal(me.status, 200);
  assert.equal((await me.json() as { id: string }).id, owner.id);

  const created = await api('/workflows', { method: 'POST', ...json({ name: 'Run integration test' }, owner.token) });
  assert.equal(created.status, 201);
  const workflow = await created.json() as { id: string; status: string };
  assert.equal(workflow.status, 'draft');
  const path = `/workflows/${workflow.id}`;
  const input = { text: 'hello nexora', labels: ['postgresql'] };

  const empty = await api(`${path}/run`, { method: 'POST', ...json({ input }, owner.token) });
  assert.equal(empty.status, 422);
  const invalid = await empty.json() as WorkflowRunReport;
  assert.ok(invalid.status === 'failed' && invalid.error.code === 'INVALID_GRAPH');

  const graph = executionGraph();
  const updated = await api(path, { method: 'PATCH', ...json(graph, owner.token) });
  assert.equal(updated.status, 200);
  const saved: unknown = await updated.json();
  const list = await api('/workflows?status=draft', { headers: auth });
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json() as { items: { id: string }[] }).items.map(item => item.id), [workflow.id]);

  const run = await api(`${path}/run`, { method: 'POST', ...json({ input }, owner.token) });
  assert.equal(run.status, 200);
  const report = await run.json() as WorkflowRunReport;
  assert.equal(report.workflowId, workflow.id);
  assert.equal(report.workflowName, 'Run integration test');
  assert.equal(report.status, 'success');
  assert.deepEqual(report.output, { ...input, text: 'HELLO NEXORA' });
  assert.deepEqual(report.nodes.map(node => node.nodeId), ['start', 'uppercase', 'wait']);
  const get = await api(path, { headers: auth });
  assert.equal(get.status, 200);
  assert.deepEqual(await get.json(), saved);

  const forbidden = await api(`${path}/run`, { method: 'POST', ...json({ input }, other.token) });
  const absent = await api(`/workflows/${randomUUID()}/run`, { method: 'POST', ...json({ input }, owner.token) });
  assert.equal(forbidden.status, 404);
  assert.equal(absent.status, 404);
  assert.deepEqual(await forbidden.json(), await absent.json());

  assert.equal((await api(path, { method: 'DELETE', headers: auth })).status, 204);
  assert.equal((await api(path, { headers: auth })).status, 404);

  const refresh = await api('/auth/refresh', { method: 'POST', headers: { Cookie: owner.cookie } });
  assert.equal(refresh.status, 200);
  const rotatedCookie = refreshCookie(refresh);
  const { accessToken: refreshedToken } = await refresh.json() as { accessToken: string };
  assert.ok(refreshedToken);
  assert.equal((await api('/auth/me', { headers: { Authorization: `Bearer ${refreshedToken}` } })).status, 200);
  assert.equal((await api('/auth/logout', { method: 'POST', headers: { Cookie: rotatedCookie } })).status, 200);
  assert.equal((await api('/auth/refresh', { method: 'POST', headers: { Cookie: rotatedCookie } })).status, 401);
});
