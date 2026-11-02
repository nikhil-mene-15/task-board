// Promise-based confirm dialog — resolved by <Confirmer /> mounted in App.
const listeners = new Set();

export function confirmDialog(message, confirmLabel = 'Delete') {
  return new Promise((resolve) => {
    for (const fn of listeners) fn({ message, confirmLabel, resolve });
  });
}

export function onConfirm(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
