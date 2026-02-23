

# Fix: PWA visar landningssidan innan appen laddas

## Problem

Nar appen oppnas fran hemskärmen (PWA) visas landningssidan i en blinkning innan den inloggade anvandaren ser sin hemvy. Detta beror pa att `Index.tsx` visar `<Landing />` medan autentiseringen laddar (`loading === true`), aven om anvandaren redan ar inloggad.

Rad 12 i `Index.tsx`:
```
if (loading || !user) {
  return <Landing />;
}
```

Nar appen startar ar `loading` alltid `true` i nagra hundra millisekunder medan sessionen hamtas -- sa landningssidan renderas och syns kort.

## Losning

Visa en **neutral laddningsvy** (spinner pa appens bakgrundsfarg) medan auth laddar, istallet for landningssidan. Landningssidan visas **bara** nar auth har laddats klart och det saknas en inloggad anvandare.

## Andringar

### `src/pages/Index.tsx`

Andra logiken sa att:
1. `loading === true` visar en minimal spinner (samma stil som profile-loading-spinnern)
2. `loading === false && !user` visar `<Landing />`
3. `loading === false && user` fortsatter till profil-check och sedan `<Home />`

```tsx
const Index = () => {
  const { user, loading } = useAuth();
  const { data: profile, isLoading: profileLoading } = useProfile();

  // Auth is still resolving -- show neutral loading screen (not landing page)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  // Auth resolved with no user -- show landing page
  if (!user) {
    return <Landing />;
  }

  // User exists, wait for profile
  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-2 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  // Check onboarding
  const prefs = profile?.preferences as Record<string, any> | null;
  const onboardingCompleted = prefs?.onboarding?.completed === true;
  if (!onboardingCompleted) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Home />;
};
```

Spinnern anvander tema-fargerna (`bg-background`, `border-foreground`) sa den matchar bade light och dark mode, och syns bara i nagra hundra millisekunder medan sessionen verifieras.

### Ingen andra fil behover andras

`AuthContext.tsx` fungerar korrekt -- den satter `loading = false` efter `getSession()` returnerar. Problemet ar enbart i hur `Index.tsx` hanterar loading-tillstandet.

