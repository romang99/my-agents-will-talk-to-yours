// api.js — thin client for the ResearcherConnect server API + SSE stream.

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `${res.status} ${res.statusText}`);
  return data;
}

export const api = {
  state: () => request('GET', '/api/state'),
  candidates: () => request('GET', '/api/candidates'),
  pairBaseline: (a, b) =>
    request('GET', `/api/baseline/${encodeURIComponent(a)}/${encodeURIComponent(b)}`),
  startRun: (pair, provider, triggerId, mode = 'conversation', judge = undefined) =>
    request('POST', '/api/runs', { pair, provider, triggerId, mode, judge }),
  createTrigger: (data) => request('POST', '/api/triggers', data),
  reset: (scope, note) => request('POST', '/api/reset', { scope, note }),
  getRun: (id) => request('GET', `/api/runs/${encodeURIComponent(id)}`),
  decide: (id, decision, note) =>
    request('POST', `/api/runs/${encodeURIComponent(id)}/decision`, { decision, note }),
  updateResearcher: (id, update) =>
    request('POST', `/api/researchers/${encodeURIComponent(id)}`, update),
  resumeRun: (id, provider) =>
    request('POST', `/api/runs/${encodeURIComponent(id)}/resume`, { provider }),
  createResearcher: (data) => request('POST', '/api/researchers', data),
  scoutResearcher: (name, hints) => request('POST', '/api/researchers/scout', { name, hints }),
  deleteResearcher: (id) => request('DELETE', `/api/researchers/${encodeURIComponent(id)}`),
};

/** Subscribe to server events. handlers = { 'run.turn': fn, ... } */
export function subscribe(handlers) {
  const source = new EventSource('/api/events');
  for (const [type, handler] of Object.entries(handlers)) {
    source.addEventListener(type, (e) => handler(JSON.parse(e.data)));
  }
  return source;
}
