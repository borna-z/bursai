

## Spara accentfärg permanent i databasen

### Problemet
Just nu sparas din valda accentfärg bara i webbläsarens lokala minne (localStorage). Det betyder att om du loggar in från en annan enhet eller rensar webbläsardata, försvinner ditt val.

### Lösningen
Accentfärgen (och temat ljus/mörk) sparas i din profil i databasen, under `preferences.theme` och `preferences.accentColor`. Då följer inställningarna med ditt konto oavsett vilken enhet du använder.

### Hur det fungerar

1. **Vid inloggning**: Appen läser din sparade accentfärg och tema från profilen och applicerar dem direkt.
2. **Vid ändring**: När du väljer en ny färg i inställningar sparas den både lokalt (för snabb respons) och till databasen (för permanens).
3. **Prioritet**: Databasvärdet vinner alltid over localStorage -- localStorage fungerar som snabb cache.

### Tekniska ändringar

| Fil | Ändring |
|-----|---------|
| `src/contexts/ThemeContext.tsx` | Importera `supabase` och `useAuth`. Vid mount: hämta `preferences.accentColor` och `preferences.theme` från profilen. Vid ändring: spara till både localStorage och `profiles.preferences` i databasen. |
| `src/components/settings/AccentColorPicker.tsx` | Ingen ändring behövs -- den anropar redan `setAccentColor` från ThemeContext. |
| `src/pages/settings/SettingsAppearance.tsx` | Ingen ändring behövs -- den anropar redan `setTheme` från ThemeContext. |

### Detaljerad implementation

**ThemeProvider** uppdateras med:
- En effekt som lyssnar på auth-state och vid inloggning hämtar profilen for att läsa `preferences.accentColor` och `preferences.theme`
- `setAccentColor` uppdateras att också köra `supabase.from('profiles').update(...)` med den nya färgen under `preferences.accentColor`
- `setTheme` uppdateras att också spara till `preferences.theme` i databasen
- Databaseskrivningar sker "fire-and-forget" i bakgrunden för att inte fördröja UI-responsen

Ingen databasändring behövs -- `profiles.preferences` är redan en flexibel JSONB-kolumn.

