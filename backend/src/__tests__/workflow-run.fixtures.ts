import { once } from 'node:events';
import type { Express } from 'express';
import type { WorkflowEdge, WorkflowNode } from '../db/workflow.types';

export function executionGraph(durationMs = 20) {
  const position = { x: 0, y: 0 };
  const nodes: WorkflowNode[] = [
    { id: 'wait', type: 'delay', position, data: { durationMs } },
    { id: 'uppercase', type: 'transform', position, data: { operation: 'uppercase' } },
    { id: 'start', type: 'manualTrigger', position, data: {} },
  ];
  const edges: WorkflowEdge[] = [
    { id: 'second', source: 'uppercase', target: 'wait' },
    { id: 'first', source: 'start', target: 'uppercase' },
  ];
  return { nodes, edges };
}

export async function startTestServer(app: Express) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected a local TCP test server.');

  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    }),
  };
}

export function json(body: unknown, token?: string): RequestInit {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return { headers, body: JSON.stringify(body) };
}
