// Top-level React error boundary for the mobile app.
//
// Without this, a render-time exception inside any screen tree (e.g. a
// malformed garment payload causing an undefined access in OutfitDetail)
// blanks the entire app instead of triggering Sentry's sentry.wrap fallback,
// which catches uncaught render errors but only reports them — RN doesn't
// recover. This component renders a localised retry surface and reports the
// error to Sentry with a `react_error_boundary` source tag so dashboards can
// distinguish render bugs from network/edge errors.
//
// Mounted near the top of App.tsx, between the providers and NavigationContainer
// so the fallback has access to theme tokens. Per-tab boundaries can be added
// in a follow-up wave if a single broken tab keeps killing the app — the goal
// of the top-level boundary is "don't blank the screen, give the user a way
// out".

import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Sentry } from '../lib/sentry';
import { useTokens } from '../theme/ThemeProvider';

type Props = {
  children: React.ReactNode;
  /** Optional override for the fallback UI. Defaults to a centred retry card. */
  fallback?: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    Sentry.withScope((scope) => {
      scope.setTag('source', 'react_error_boundary');
      scope.setContext('react_error_info', {
        componentStack: info.componentStack ?? '',
      });
      Sentry.captureException(error);
    });
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return <DefaultErrorFallback onReset={this.reset} />;
  }
}

// Hardcoded English copy: the error boundary must NOT depend on the i18n
// module at render time — if i18n itself is what threw, importing `t` from
// it could re-throw inside the fallback and produce a true blank screen.
// Translation can be added later via a self-contained dictionary if needed.
function DefaultErrorFallback({ onReset }: { onReset: () => void }) {
  const t = useTokens();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: t.bg,
        padding: 24,
      }}>
      <Text
        style={{
          color: t.fg,
          fontSize: 22,
          fontWeight: '600',
          textAlign: 'center',
          marginBottom: 12,
        }}>
        Something went wrong
      </Text>
      <Text
        style={{
          color: t.fg2,
          fontSize: 14,
          lineHeight: 20,
          textAlign: 'center',
          marginBottom: 24,
          maxWidth: 320,
        }}>
        We&apos;ve reported this issue. You can try again, or close and reopen the
        app if the problem persists.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Try again"
        onPress={onReset}
        style={({ pressed }) => ({
          backgroundColor: t.accent,
          paddingHorizontal: 28,
          paddingVertical: 12,
          borderRadius: 999,
          opacity: pressed ? 0.85 : 1,
        })}>
        <Text style={{ color: t.accentFg, fontWeight: '600', fontSize: 15 }}>
          Try again
        </Text>
      </Pressable>
    </View>
  );
}
