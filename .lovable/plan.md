

## Fix: Use correct location icon in Travel Capsule destination input

The destination input currently uses `MapPin` from lucide-react, which appears as a faint, hard-to-recognize circle at the current size and opacity. The user wants a more recognizable location symbol.

### Change

In `src/pages/TravelCapsule.tsx` line 414, replace `MapPin` with `Navigation` (or `Globe`) icon for better visual recognition of a destination/location field. Given this is a travel destination field, `Globe` is the most semantically appropriate icon.

Alternatively, the issue may be that the icon opacity is too low (`text-muted-foreground/50`). The fix will:
1. Switch from `MapPin` to `Globe` icon (more fitting for a travel destination)
2. Increase icon visibility by using `text-muted-foreground` instead of `text-muted-foreground/50`

### Files to edit
- `src/pages/TravelCapsule.tsx`: Replace `MapPin` with `Globe` in the import and in the destination input icon, and adjust opacity.

