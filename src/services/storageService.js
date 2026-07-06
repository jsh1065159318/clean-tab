const parseStoredValue = (value, fallback) => {
  if (value === null || value === undefined) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const storageService = {
  get(key, fallback = null) {
    return parseStoredValue(localStorage.getItem(key), fallback);
  },

  set(key, value) {
    const storedValue = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, storedValue);
    return value;
  },

  remove(key) {
    localStorage.removeItem(key);
  },

  getJSON(key, fallback = null) {
    return parseStoredValue(localStorage.getItem(key), fallback);
  },

  setJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  },
};
