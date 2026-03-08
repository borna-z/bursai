

## AI Chat / Stylist — Apple Minimalism Redesign

### Current State
The chat page is functional but feels like a standard chat UI. Opportunities: more breathing space, cleaner header, more elegant bubbles, premium welcome screen, and a refined floating input.

### Changes

#### 1. `src/pages/AIChat.tsx` — Layout & Header
- Remove border-b from header; use only backdrop-blur separation
- Increase message area spacing from `space-y-6` to `space-y-8`
- Refine mode switcher: pill-shaped segmented control with subtle background instead of underline tabs
- Typing indicator: softer, smaller dots with more elegant animation
- Add `pb-2` safe area below input

#### 2. `src/components/chat/ChatMessage.tsx` — Elegant Bubbles
- **User bubbles**: Change from `bg-muted/60 rounded-2xl rounded-br-md` to `bg-foreground/[0.06] rounded-2xl rounded-br-sm` — subtler, no harsh background
- **Assistant messages**: Remove the avatar circle icon; use clean left-aligned text without icon for a more Apple Notes/ChatGPT-like feel. Keep the icon only in welcome state.
- Assistant text: bump to `text-[15px] leading-[1.7]` for better readability
- User images: increase to `h-32 w-32 rounded-2xl`
- Streaming cursor: thinner, accent-colored

#### 3. `src/components/chat/ChatInput.tsx` — Premium Input
- Larger input bar: `rounded-3xl` with more internal padding (`px-3 py-3`)
- Send button: circular `rounded-full` instead of `rounded-xl`, slightly larger `h-10 w-10`
- Image button: `rounded-full` matching
- Remove disclaimer text (or make it only visible on first visit)
- Pending image preview: `rounded-xl` with `h-20 w-20`

#### 4. `src/components/chat/ChatWelcome.tsx` — Premium Welcome
- Larger icon container: `w-24 h-24 rounded-[28px]`
- Welcome text: `text-lg` with `font-light` for elegance
- Suggestion chips: more padding `px-5 py-3`, `rounded-2xl`, `text-[13px]`, with subtle border instead of background-only
- More vertical spacing between elements (`mb-8`, `mt-8`)

#### 5. `src/components/chat/GarmentInlineCard.tsx`
- Slightly larger pill: `h-8` thumbnail, `text-[13px]` label
- Softer border: `border-border/30`

### Files to Edit
1. `src/pages/AIChat.tsx`
2. `src/components/chat/ChatMessage.tsx`
3. `src/components/chat/ChatInput.tsx`
4. `src/components/chat/ChatWelcome.tsx`
5. `src/components/chat/GarmentInlineCard.tsx`

