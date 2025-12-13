/**
 * Simple helper to simulate latency and store JSON in localStorage per key.
 */
export const delay = (ms = 400) => new Promise((res) => setTimeout(res, ms));

export const uuid = () => crypto.randomUUID();

export function getData<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

export function setData<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}
