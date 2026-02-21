

## Fix Chat Header Scroll Issue and Add Premium Animations

### Problem
The Stylist/Shopping mode switcher header scrolls out of view when scrolling chat messages. This happens because `AppLayout`'s `<main>` has `overflow-y-auto` and the chat's inner container height (`calc(100dvh - 4rem)`) combined with `pb-20` causes the outer container to also scroll, taking the header with it.

### Changes

#### 1. Fix the scroll architecture in `src/pages/AIChat.tsx`
- Pass `hideNav` to `AppLayout` so the outer `<main>` doesn't add `pb-20` padding that causes overflow
- Instead, manage the bottom nav visibility separately by **not** hiding it -- instead adjust the inner container height to account for bottom nav (`calc(100dvh - 4rem - 5rem)` or use `h-full` approach)
- Alternative simpler fix: make the header `sticky top-0 z-10 bg-background` so it pins to the top of the scroll container even if the outer main scrolls
- Add `shrink-0` to the header so it never collapses in the flex layout

#### 2. Add entrance animations to `src/components/chat/ChatMessage.tsx`
- Each message fades + slides in from below using `animate-fade-in` (already defined in tailwind config)
- Assistant avatar icon gets a subtle scale-in animation
- Streaming cursor uses a smoother pulse animation

#### 3. Add animations to `src/components/chat/ChatWelcome.tsx`
- Icon container: scale-in animation on mount
- Welcome text: fade-in with slight delay
- Suggestion chips: staggered fade-in (each chip gets increasing `animation-delay`)

#### 4. Add animations to `src/components/chat/ChatInput.tsx`
- Input bar: subtle fade-in on mount
- Send button: micro scale on hover/tap via `transition-transform hover:scale-105 active:scale-95`

#### 5. Mode switcher transition in `src/pages/AIChat.tsx`
- Add `transition-all duration-200` to mode switcher buttons for smoother active state changes
- Message area gets a subtle opacity transition when switching modes

---

### Technical details

**Scroll fix approach**: The simplest reliable fix is making the header `sticky top-0 z-10 bg-background/95 backdrop-blur-sm` within the flex container. This ensures it stays visible regardless of scroll behavior. Combined with ensuring the flex container itself is `overflow-hidden` and only the messages div scrolls.

**Animation classes used** (all pre-existing in the project):
- `animate-fade-in` -- 0.3s ease-out fade + translate
- `animate-scale-in` -- 0.2s ease-out scale
- Custom stagger delays via inline `style={{ animationDelay }}`
- `transition-transform` + `hover:scale-105` for micro-interactions

### Files modified (4 total)
1. `src/pages/AIChat.tsx` -- sticky header fix, mode switch animation
2. `src/components/chat/ChatMessage.tsx` -- message entrance animations
3. `src/components/chat/ChatWelcome.tsx` -- welcome state animations with stagger
4. `src/components/chat/ChatInput.tsx` -- input bar animations, button micro-interactions
