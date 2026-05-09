// In-memory @react-native-async-storage/async-storage mock — N4.
//
// Mirrors the subset of the API the offline queue and supabase auth
// persistence touch. Tests can call `__resetAsyncStorageMock()` between
// cases to start with a clean store.

const store = new Map<string, string>();

const AsyncStorage = {
  getItem: jest.fn(async (key: string) => store.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    store.delete(key);
  }),
  multiGet: jest.fn(async (keys: string[]) =>
    keys.map((k) => [k, store.get(k) ?? null] as [string, string | null]),
  ),
  multiSet: jest.fn(async (pairs: [string, string][]) => {
    pairs.forEach(([k, v]) => store.set(k, v));
  }),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((k) => store.delete(k));
  }),
  clear: jest.fn(async () => {
    store.clear();
  }),
  getAllKeys: jest.fn(async () => Array.from(store.keys())),
};

export default AsyncStorage;

export function __resetAsyncStorageMock(): void {
  store.clear();
  Object.values(AsyncStorage).forEach((fn) => {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      (fn as jest.Mock).mockClear();
    }
  });
}

export function __getAsyncStorageStore(): Map<string, string> {
  return store;
}
