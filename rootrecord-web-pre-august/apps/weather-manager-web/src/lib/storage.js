function noop() {}

function getLocalStorage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage || null;
  } catch {
    return null;
  }
}

function getSessionStorage() {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage || null;
  } catch {
    return null;
  }
}

export const safeLocalStorage = {
  getItem(key) {
    try {
      return getLocalStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      getLocalStorage()?.setItem(key, String(value));
    } catch {
      noop();
    }
  },
  removeItem(key) {
    try {
      getLocalStorage()?.removeItem(key);
    } catch {
      noop();
    }
  },
};

export const safeSessionStorage = {
  getItem(key) {
    try {
      return getSessionStorage()?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      getSessionStorage()?.setItem(key, String(value));
    } catch {
      noop();
    }
  },
  removeItem(key) {
    try {
      getSessionStorage()?.removeItem(key);
    } catch {
      noop();
    }
  },
};

