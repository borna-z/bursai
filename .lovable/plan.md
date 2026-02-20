

## Rename all "DRAPE" branding to "BURS"

There are a few leftover references to "DRAPE" in the codebase. Here's exactly what will change:

### 1. ResetPassword page -- text says "DRAPE"
**`src/pages/ResetPassword.tsx`** (line 114): Change `DRAPE` to `BURS`

### 2. Tailwind config -- comment says "DRAPE"
**`tailwind.config.ts`** (line 64): Update comment from `// DRAPE extended semantic tokens` to `// BURS extended semantic tokens`

### 3. DrapeLogo component -- rename to BursLogo
**`src/components/ui/DrapeLogo.tsx`**: Rename the component and interface from `DrapeLogo`/`DrapeLogoProps` to `BursLogo`/`BursLogoProps`. The file itself can stay (it's not imported anywhere currently), but the naming will be consistent.

### Not changing (animation names)
The CSS animation names `drape-in` and `drape-out` in tailwind config and their usage across components (`animate-drape-in`, `stagger-drape`) are internal animation names, not user-facing branding. These are fine to leave as-is since renaming them would touch many files for zero user impact.

### Not changing (asset file)
`src/assets/drape-logo.png` exists but is not imported or used anywhere. It can be left or removed -- no user impact.

