import "@testing-library/jest-dom";
import { beforeEach, vi } from "vitest";

function createStorageMock() {
  let store: Record<string, string> = {};
  const getItem = vi.fn((key: string) => store[key] ?? null);
  const setItem = vi.fn((key: string, value: string) => {
    store[key] = String(value);
  });
  const removeItem = vi.fn((key: string) => {
    delete store[key];
  });
  const clear = vi.fn(() => {
    store = {};
  });
  const key = vi.fn((index: number) => Object.keys(store)[index] ?? null);

  const storage: Storage = {
    getItem,
    setItem,
    removeItem,
    clear,
    key,
    get length() {
      return Object.keys(store).length;
    },
  };

  const reset = () => {
    store = {};
    getItem.mockClear();
    setItem.mockClear();
    removeItem.mockClear();
    clear.mockClear();
    key.mockClear();
  };

  return { storage, reset };
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock.storage,
  configurable: true,
  writable: true,
});
Object.defineProperty(globalThis, "sessionStorage", {
  value: sessionStorageMock.storage,
  configurable: true,
  writable: true,
});

beforeEach(() => {
  localStorageMock.reset();
  sessionStorageMock.reset();
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
