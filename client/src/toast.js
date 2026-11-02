// Tiny pub/sub so toast() can be called from anywhere — event handlers,
// async callbacks — without prop drilling or context.
const listeners = new Set();
let nextId = 1;

export function toast(message, type = 'info') {
  for (const fn of listeners) fn({ id: nextId++, message, type });
}

export function onToast(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
