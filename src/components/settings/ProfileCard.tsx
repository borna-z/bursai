import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { useLanguage } from '@/contexts/LanguageContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Crown } from 'lucide-react';

export function ProfileCard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { isPremium } = useSubscription();
  const { t } = useLanguage();

  const displayName = profile?.display_name || user?.email?.split('@')[0] || '';
  const initials = displayName.slice(0, 2).toUpperCase();
  const email = user?.email || '';

  return (
    <div className="flex items-center gap-4 py-2">
      <Avatar className="w-16 h-16">
        <AvatarFallback className="bg-primary/8 text-primary font-semibold text-lg">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold truncate">{displayName}</p>
          {isPremium && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary uppercase tracking-wide">
              <Crown className="w-3 h-3" />
              {t('common.premium')}
            </span>
          )}
        </div>
        <p className="text-[13px] text-muted-foreground/60 truncate">{email}</p>
      </div>
    </div>
  );
}
