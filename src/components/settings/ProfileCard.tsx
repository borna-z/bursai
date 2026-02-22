import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { useLanguage } from '@/contexts/LanguageContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <Avatar className="w-14 h-14">
          <AvatarFallback className="bg-accent/10 text-accent font-semibold text-base">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
        </div>
        {isPremium && (
          <Badge variant="secondary" className="bg-premium/10 text-premium border-premium/20 text-[10px] gap-1">
            <Crown className="w-3 h-3" />
            {t('common.premium')}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
