
# Replace Emojis with Premium Icons -- Today View

## Problem
The Today view uses Unicode emojis (`☀️`, `💼`, `🎉`, `❤️`, `🏃`, `✈️`, `🏆`) which look inconsistent across platforms and clash with the premium Scandinavian aesthetic.

## Solution
Replace all emojis with Lucide React icons matching the app's existing icon language.

### Changes in `src/pages/Home.tsx`

**1. Add Lucide imports** (line 3)
Add: `Sun, Briefcase, PartyPopper, Heart, PersonStanding, Plane, Trophy`

**2. Refactor OCCASIONS config** (lines 31-59)
Change the `icon` field from emoji strings to Lucide component references:

| Occasion | Emoji | Lucide Icon |
|----------|-------|-------------|
| vardag   | `☀️`  | `Sun`       |
| jobb     | `💼`  | `Briefcase` |
| fest     | `🎉`  | `PartyPopper` |
| dejt     | `❤️`  | `Heart`     |
| traning  | `🏃`  | `Dumbbell`  |
| resa     | `✈️`  | `Plane`     |

Update the `OccasionOption` interface: change `icon: string` to `icon: React.ElementType`.

**3. Update occasion button rendering** (line 333)
Replace `<span className="text-lg">{occ.icon}</span>` with:
```tsx
<occ.icon className="w-5 h-5" />
```
This renders a clean monochrome Lucide icon instead of a colorful emoji.

**4. Replace trophy emoji** (line 141)
Replace `🏆 {t('insights.top_garments')}` with:
```tsx
<Trophy className="w-4 h-4 text-amber-500" /> {t('insights.top_garments')}
```

### Visual Result
- All icons become monochrome line icons matching the app's design system
- Icons inherit text color and respond to dark/light mode automatically
- Consistent sizing via Tailwind classes instead of platform-dependent emoji rendering
- Premium, minimal Scandinavian feel maintained throughout
