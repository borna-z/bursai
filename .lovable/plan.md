

# Smart AI Stylist with Image Upload

## Overview

Upgrade the DRAPE AI chat to support image uploads. Users can photograph themselves in an outfit and get instant feedback: swap suggestions from their wardrobe, fit analysis based on body measurements, occasion matching from their calendar, and weather-appropriate recommendations.

## What Changes

### 1. Frontend: Image Upload in Chat (AIChat.tsx)

- Add a camera/gallery button next to the text input (using the `ImagePlus` icon from Lucide)
- When tapped, open a file picker (`accept="image/*"`) with camera capture support on mobile
- Upload the selected image to the existing `garments` storage bucket under a `chat/` prefix (e.g., `{userId}/chat/{timestamp}.jpg`)
- Create a signed URL for the uploaded image
- Send the message to the edge function with a multimodal content array (text + image_url) instead of plain text
- Display uploaded images inline in the chat as thumbnails above the user's message bubble

**Message format change:**
```typescript
// Before: { role: 'user', content: 'string' }
// After:  { role: 'user', content: [{ type: 'text', text: '...' }, { type: 'image_url', image_url: { url: '...' } }] }
```

- The `MessageBubble` component will be updated to detect multimodal content and render images alongside text
- Chat persistence will store a JSON-serialized version of multimodal messages in the existing `content` column (the edge function will handle parsing)

### 2. Backend: Enhanced style_chat Edge Function

- Accept multimodal messages (content can be string or array of text/image parts)
- Forward image URLs directly to the AI gateway (Gemini 3 Flash supports vision natively)
- Enrich the system prompt with additional context:
  - **Wardrobe details**: Fetch full garment list (title, category, color, image signed URLs for up to 10 items) so the AI can suggest specific swaps
  - **Calendar events**: Fetch today's and tomorrow's events from `calendar_events` table
  - **Weather**: Fetch current weather from Open-Meteo using the user's `home_city` coordinates
- Update system prompt to instruct the AI to:
  - Analyze uploaded outfit photos
  - Suggest specific garment swaps from the user's wardrobe (by name)
  - Consider body proportions (height/weight already available)
  - Match recommendations to calendar events and weather
  - Give actionable feedback ("That t-shirt would work better with your navy chinos for tomorrow's meeting")

### 3. System Prompt Enhancement

Add these capabilities to the existing system prompt:

```
When the user uploads a photo:
- Analyze what they're wearing (colors, fit, style, occasion suitability)
- Compare against their wardrobe and suggest specific swaps by garment name
- Consider their body measurements for fit advice
- Check today's calendar events and suggest if the outfit matches
- Check current weather and warn if inappropriate
- Be specific: "Byt ut den vita t-shirten mot din marinblå Oxford-skjorta för morgondagens möte"
```

### 4. Storage

No new bucket needed. Reuse the existing private `garments` bucket with a `chat/` path prefix. Images are temporary chat attachments -- they use signed URLs that expire.

## Files to Create/Modify

| File | Change |
|------|--------|
| `src/pages/AIChat.tsx` | Add image upload button, multimodal message handling, image preview in bubbles |
| `supabase/functions/style_chat/index.ts` | Accept multimodal messages, add calendar + weather context, enrich garment data with titles |

## Technical Details

### Image Flow

```text
User taps camera icon
  -> File picker opens (camera or gallery)
  -> Image uploaded to storage bucket (garments/{userId}/chat/{timestamp}.jpg)
  -> Signed URL generated (1 hour expiry)
  -> Message sent as multimodal content to edge function
  -> Edge function forwards image URL to Gemini 3 Flash (vision-capable)
  -> AI analyzes outfit + cross-references wardrobe/calendar/weather
  -> Streaming response with specific swap suggestions
```

### AI Model

Using `google/gemini-3-flash-preview` (already in use) which supports vision/multimodal input natively. No model change needed.

### Weather Integration in Edge Function

The edge function will geocode the user's `home_city` using Nominatim (same as the frontend `useWeather` hook) and fetch current conditions from Open-Meteo. This adds ~200ms latency but provides critical context for outfit advice.

### Calendar Integration in Edge Function

Query `calendar_events` for the authenticated user for today and tomorrow, then include event titles in the system prompt so the AI knows what the user has planned.

### No Database Migration Needed

- Chat images stored in existing `garments` bucket under `chat/` prefix
- Multimodal message content stored as JSON string in existing `content` text column
- All new data fits existing schema

