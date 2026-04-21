import { useAuth } from '@/contexts/AuthContext';
import { useProfile } from '@/hooks/useProfile';
import { useSubscription } from '@/hooks/useSubscription';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Avatar-upload was removed (Wave 0+1 cleanup sweep): the `avatars` storage
// bucket was dropped from prod and the feature is retired per product decision.
// See CLAUDE.md Findings Log (2026-04-20, P0d-iv). Component now renders the
// initials-fallback Avatar only.
export function ProfileCard() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { isPremium, plan } = useSubscription();

  const displayName = profile?.display_name || user?.email?.split('@')[0] || '';
  const initials = displayName.slice(0, 2).toUpperCase();
  const email = user?.email || '';

  return (
    <div className="flex items-center gap-4 py-2">
      <Avatar className="h-14 w-14">
        <AvatarFallback className="bg-primary/8 text-primary font-semibold text-lg">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="text-[17px] font-medium truncate">{displayName}</p>
        {/* Plan tier badge */}
        <div className={`mt-1 mb-0.5 inline-flex items-center px-2 py-0.5 ${isPremium ? 'bg-foreground' : 'bg-secondary'}`}>
          <span className={`font-body text-[11px] ${isPremium ? 'text-background' : 'text-foreground/50'}`}>
            {plan === 'premium' ? 'Plus' : 'Free plan'}
          </span>
        </div>
        <p className="text-[13px] text-muted-foreground/60 truncate">{email}</p>
      </div>
    </div>
  );
}
