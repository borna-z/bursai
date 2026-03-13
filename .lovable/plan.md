

## Remove blurry icon from destination input

Remove the `Globe` icon from the destination input field in `src/pages/TravelCapsule.tsx` and adjust the input's left padding back to default (remove `pl-10`).

### Changes
**`src/pages/TravelCapsule.tsx`**
- Delete line 414 (`<Globe>` element)
- Remove `pl-10` class from the `<Input>` on line 416 so text aligns normally
- Remove `Globe` from the lucide-react import if unused elsewhere

