import { Sparkles, ShoppingBag } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface ChatWelcomeProps {
  mode: 'stylist' | 'shopping';
  onSuggestion: (text: string) => void;
}

export function ChatWelcome({ mode, onSuggestion }: ChatWelcomeProps) {
  const { t } = useLanguage();
  const Icon = mode === 'shopping' ? ShoppingBag : Sparkles;
  const welcomeText = mode === 'shopping' ? t('chat.shopping_welcome') : t('chat.welcome');
  const suggestions = [t('chat.suggestion_1'), t('chat.suggestion_2'), t('chat.suggestion_3')];

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mb-5 animate-scale-in">
        <Icon className="w-7 h-7 text-accent" />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground max-w-xs whitespace-pre-wrap animate-fade-in" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
        {welcomeText}
      </p>
      <div className="flex flex-wrap gap-2 justify-center mt-6 max-w-sm">
        {suggestions.map((s, i) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="px-3.5 py-2 text-xs rounded-xl border border-border bg-background hover:bg-muted/60 text-foreground transition-colors animate-fade-in"
            style={{ animationDelay: `${200 + i * 80}ms`, animationFillMode: 'both' }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
