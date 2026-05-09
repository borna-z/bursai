// In-memory react-native-purchases mock — N4 boundary mock.
//
// `mobile/src/lib/revenuecat.ts` dynamic-imports this module. Tests can
// override the per-test entitlements / cancel state via the helpers
// below. Default state: empty entitlements, no offerings, no cancel.

type Entitlement = { identifier: string; isActive: boolean };

interface State {
  entitlements: Record<string, Entitlement>;
  cancelOnPurchase: boolean;
  failOnRestore: Error | null;
  offerings: unknown;
}

const state: State = {
  entitlements: {},
  cancelOnPurchase: false,
  failOnRestore: null,
  offerings: null,
};

const Purchases = {
  configure: jest.fn(),
  logIn: jest.fn(async () => ({ customerInfo: makeCustomerInfo() })),
  logOut: jest.fn(async () => ({ customerInfo: makeCustomerInfo() })),
  getOfferings: jest.fn(async () => state.offerings),
  getCustomerInfo: jest.fn(async () => makeCustomerInfo()),
  purchasePackage: jest.fn(async (_pkg: unknown) => {
    if (state.cancelOnPurchase) {
      const err: any = new Error('User cancelled');
      err.userCancelled = true;
      throw err;
    }
    return { customerInfo: makeCustomerInfo() };
  }),
  restorePurchases: jest.fn(async () => {
    if (state.failOnRestore) throw state.failOnRestore;
    return makeCustomerInfo();
  }),
  setLogLevel: jest.fn(),
};

function makeCustomerInfo() {
  return {
    entitlements: { active: state.entitlements },
    originalAppUserId: 'app-user-1',
  };
}

export default Purchases;

export const LOG_LEVEL = { DEBUG: 'DEBUG', INFO: 'INFO', WARN: 'WARN', ERROR: 'ERROR' };
export const PURCHASES_ERROR_CODE = { PurchaseCancelledError: 1 };

// ─── Test helpers ─────────────────────────────────────────────────────
export function __setEntitlements(active: string[]): void {
  state.entitlements = Object.fromEntries(
    active.map((id) => [id, { identifier: id, isActive: true }]),
  );
}

export function __setCancelOnPurchase(cancel: boolean): void {
  state.cancelOnPurchase = cancel;
}

export function __setRestoreError(err: Error | null): void {
  state.failOnRestore = err;
}

export function __setOfferings(offerings: unknown): void {
  state.offerings = offerings;
}

export function __resetPurchasesMock(): void {
  state.entitlements = {};
  state.cancelOnPurchase = false;
  state.failOnRestore = null;
  state.offerings = null;
  Purchases.configure.mockClear();
  Purchases.purchasePackage.mockClear();
  Purchases.restorePurchases.mockClear();
  Purchases.getOfferings.mockClear();
}
