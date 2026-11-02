const request = async (path, options = {}) => {
  const res = await fetch(path, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }
  return res.json();
};

const post = (path, body, method = 'POST') =>
  request(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

export const api = {
  board: () => request('/api/board'),
  createTask: (t) => post('/api/tasks', t),
  updateTask: (id, t) => post(`/api/tasks/${id}`, t, 'PATCH'),
  deleteTask: (id) => request(`/api/tasks/${id}`, { method: 'DELETE' }),
  reorder: (columns) => post('/api/tasks/reorder', { columns }),
  createProject: (p) => post('/api/projects', p),
  createColumn: (c) => post('/api/columns', c),
  scrum: ({ limit = 30, offset = 0, q = '' } = {}) =>
    request(`/api/scrum?limit=${limit}&offset=${offset}&q=${encodeURIComponent(q)}`),
  scrumNote: (date) => request(`/api/scrum/${date}`),
  saveScrumNote: (date, note) => post(`/api/scrum/${date}`, note, 'PUT'),
  deleteScrumNote: (date) => request(`/api/scrum/${date}`, { method: 'DELETE' }),
  exportText: async (from, to) => {
    const res = await fetch(`/api/export?from=${from}&to=${to}`);
    if (!res.ok) throw new Error('Export failed');
    return res.text();
  },
  exportScrumText: async (from, to) => {
    const res = await fetch(`/api/scrum-export?from=${from}&to=${to}`);
    if (!res.ok) throw new Error('Export failed');
    return res.text();
  },
};
