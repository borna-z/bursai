
## Redesign AI Stylist Chat -- ChatGPT-style Layout

The current chat looks fragmented -- garment cards break the text flow, bubbles feel like Excel rows, and the overall experience doesn't feel premium. This redesign creates a clean, modern ChatGPT-inspired conversational interface while keeping the DRAPE design language.

---

### What changes

#### 1. Remove chat bubble alignment -- use left-aligned conversation flow
- **Current**: User messages right-aligned in colored bubbles, assistant left-aligned in grey bubbles with avatar circles. Feels dated.
- **New**: All messages flow top-to-bottom. User messages get a subtle background card (right-aligned or a light pill). Assistant messages are left-aligned plain text with no bubble -- just clean typography with a small avatar/icon above. Similar to ChatGPT's flat layout.

#### 2. Redesign the header area
- **Current**: Cramped header with "BURS Stylist" title, mode switcher pills, insights icon, and trash icon all jammed together.
- **New**: Clean minimal header with just the mode switcher centered. Move clear history into a dropdown menu (three-dot icon). Remove the insights link from the header (it's already in the bottom nav via other routes).

#### 3. Redesign the input area -- ChatGPT-style floating input
- **Current**: Fixed bar at bottom with separate image/send buttons and a basic textarea. Feels disconnected.
- **New**: Centered floating input container with rounded corners and a subtle border/shadow. Image upload button and send button inside the input container (not outside). Textarea auto-grows. The whole input bar feels like one cohesive element. Disclaimer text below.

#### 4. Better message rendering with markdown
- **Current**: Plain `whitespace-pre-wrap` text with garment cards inline breaking the flow.
- **New**: Better paragraph spacing. Garment inline cards rendered as compact horizontal chips below the relevant text paragraph instead of breaking mid-sentence. Assistant messages use slightly better typography (line-height, paragraph gaps).

#### 5. Welcome state -- centered with suggestions
- **Current**: Welcome message appears as a chat bubble with suggestion chips below.
- **New**: Welcome state is centered vertically with a large icon, greeting text, and suggestion chips arranged as cards/pills beneath. Like ChatGPT's empty state. Once a conversation starts, it switches to the normal message flow.

#### 6. Streaming indicator
- **Current**: Three bouncing dots inside a bubble.
- **New**: Typing indicator as a subtle shimmer or pulsing cursor at the end of the streaming text (like ChatGPT's blinking cursor).

---

### Technical implementation

**File: `src/pages/AIChat.tsx`** -- Major rewrite of the UI layout:

1. **Header**: Replace `PageHeader` with a custom slim header containing only the mode switcher (centered) and a menu button (right). Use a `DropdownMenu` for clear history.

2. **Message area**: Remove bubble styling. User messages get a subtle `bg-muted/40` full-width card. Assistant messages are plain text. Add proper paragraph rendering with `whitespace-pre-wrap` and `leading-relaxed`.

3. **Welcome state**: When `messages.length === 1` (just the welcome message), render a centered hero layout with the Sparkles/ShoppingBag icon large, the greeting text, and suggestion chips as rounded cards.

4. **Input bar**: Create a single container `div` with `rounded-2xl border shadow-sm` that contains the image button, auto-growing textarea, and send button all inside. Position it at the bottom with proper spacing above the bottom nav.

5. **Pending image**: Show as a small thumbnail inside the input container (above the text row).

6. **MessageBubble component**: Refactor to `ChatMessage` with flat layout. User: right-aligned text in a subtle pill. Assistant: left-aligned with small avatar, clean text, garment cards rendered as a row below the text.

7. **Streaming**: Add a blinking cursor (`|` character with CSS animation) at the end of streaming text instead of bouncing dots.

**File: `src/components/chat/GarmentInlineCard.tsx`** -- Minor style tweaks:
- Make cards slightly more compact and visually consistent with the new flat layout.

**No new dependencies needed** -- uses existing Radix UI components (DropdownMenu) and Tailwind classes.

### Design tokens used
- Background: `bg-background` (warm off-white)
- User message: `bg-muted/50` with subtle rounded corners
- Assistant message: plain text on background, no bubble
- Input container: `bg-background border border-border/80 shadow-sm rounded-2xl`
- Accent for send button: `bg-primary text-primary-foreground`
- Avatar: small 28px circle with accent icon
