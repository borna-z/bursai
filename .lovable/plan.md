

# Upgrade useLiveScan tests with improved helpers

## What changes

Replace `src/hooks/__tests__/useLiveScan.test.tsx` with the version you proposed earlier. This is safe because:

1. **All 3 existing tests are preserved** — initial state, accept no-op, and retake — with identical assertions
2. **Mocking is improved** — global stubs moved into reusable `setupCanvasMock()`, `setupFileReaderMock()`, `setupUrlMock()`, `setupSupabaseMock()`, and `mockAuthUser()` helpers, with proper `afterEach` cleanup via `unstubAllGlobals()` and `restoreAllMocks()`
3. **Two new tests added**:
   - Full `capture() → accept() → finish()` flow verifying AI call, storage upload path, and DB insert
   - Error state when edge function fails
4. **No risk to other tests** — the `@tanstack/react-query` mock is replaced with a proper `QueryClientProvider` wrapper (same pattern as the subscription tests), which is more realistic and avoids leaking mock state

### File: `src/hooks/__tests__/useLiveScan.test.tsx`
- Replace entire contents with your proposed version (the one from the previous message with `createWrapper`, `mockAuthUser`, `setupCanvasMock`, `setupFileReaderMock`, `setupUrlMock`, `setupSupabaseMock`, and 5 test cases)

