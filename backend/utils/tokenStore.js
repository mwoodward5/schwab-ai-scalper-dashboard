/**
 * Simple in-memory token store for development.
 * Replace with Redis/DB in production.
 */
const store = new Map();

module.exports.tokenStore = {
  has: (key) => store.has(key),
  get: (key) => store.get(key),
  set: (key, value) => store.set(key, value),
  delete: (key) => store.delete(key),
  clear: () => store.clear(),
};
