

# Add Language Selector to Settings Page

## What changes

Add a new "Language" card to the Settings page, placed right after the Theme/Appearance card. It will show the currently selected language with its flag emoji and allow switching via a dropdown (Select component).

## UI Design

```text
+---------------------------------------------+
| Globe  Sprak                                |
|                                              |
|  [ SE Svenska              v ]              |
|                                              |
+---------------------------------------------+
```

Uses the existing `Select` component with `SUPPORTED_LOCALES` data. Each option shows flag + native name (e.g. "SE Svenska", "GB English").

## Technical Details

### File: `src/pages/Settings.tsx`

1. Add imports:
   - `Globe` from lucide-react
   - `useLanguage` from `@/contexts/LanguageContext`
   - `SUPPORTED_LOCALES` and `Locale` from `@/i18n/translations`

2. Inside the component, destructure `{ locale, setLocale }` from `useLanguage()`

3. Add a new `<Card>` block between the Theme card (line ~272) and the CalendarSection (line ~275):

```tsx
<Card>
  <CardHeader className="pb-3">
    <div className="flex items-center gap-2">
      <Globe className="w-5 h-5" />
      <CardTitle className="text-base">Sprak</CardTitle>
    </div>
  </CardHeader>
  <CardContent>
    <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_LOCALES.map((loc) => (
          <SelectItem key={loc.code} value={loc.code}>
            {loc.flag} {loc.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </CardContent>
</Card>
```

That is the only file that needs to change. The `LanguageContext` already handles persistence (localStorage + profile preferences), so the selection is saved automatically.

