import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { logger } from '@/lib/logger';
import { type Locale, SUPPORTED_LOCALES } from '@/i18n/types';

/** Hardcoded error strings so ErrorBoundary never depends on async translations */
const ERROR_STRINGS: Record<string, Record<string, string>> = {
  en: { 'error.title': 'Something went wrong', 'error.desc': 'An unexpected error occurred. Try reloading the page.', 'error.try_again': 'Try again', 'error.reload': 'Reload' },
  sv: { 'error.title': 'Något gick fel', 'error.desc': 'Ett oväntat fel uppstod. Prova att ladda om sidan.', 'error.try_again': 'Försök igen', 'error.reload': 'Ladda om' },
};

function getLocale(): Locale {
  const stored = localStorage.getItem('burs-locale') as Locale | null;
  if (stored && SUPPORTED_LOCALES.some(l => l.code === stored)) return stored;
  return 'en';
}

/** Report error to Sentry if loaded (lazy-loaded, so may not be available) */
async function reportToSentry(error: Error, componentStack?: string) {
  try {
    const Sentry = await import('@sentry/react');
    Sentry.captureException(error, {
      contexts: {
        react: { componentStack: componentStack || 'N/A' },
      },
    });
  } catch {
    // Sentry not available — silently ignore
  }
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    logger.error('[ErrorBoundary]', error.message, info.componentStack);
    reportToSentry(error, info.componentStack ?? undefined);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  t = (key: string): string => {
    const locale = getLocale();
    return ERROR_STRINGS[locale]?.[key] ?? ERROR_STRINGS['en']?.[key] ?? key;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-sm w-full text-center space-y-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-foreground">{this.t('error.title')}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {this.t('error.desc')}
              </p>
            </div>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-xs text-left text-destructive/80 bg-destructive/5 rounded-xl p-3 overflow-auto max-h-32">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <Button variant="outline" size="sm" onClick={this.handleReset}>
                {this.t('error.try_again')}
              </Button>
              <Button size="sm" onClick={this.handleReload} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                {this.t('error.reload')}
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
