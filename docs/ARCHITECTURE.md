# BURS Architecture Documentation

## Table of Contents
1. [System Architecture](#system-architecture)
2. [AI Engine (burs-ai.ts)](#ai-engine)
3. [Data Flow](#data-flow)
4. [Billing Flow](#billing-flow)
5. [Security Model](#security-model)
6. [Edge Functions Reference](#edge-functions-reference)

---

## System Architecture

BURS follows a three-tier architecture:

1. **Client** — React SPA with offline-first data layer
2. **Backend** — Supabase (Auth, PostgreSQL, Storage, Edge Functions)
3. **External** — Stripe (billing), Google Calendar, Lovable AI Gateway

### Key Design Decisions
- **Offline-first**: React Query with `networkMode: 'offlineFirst'` and 30-min GC time
- **Route-based code splitting**: 30+ pages lazy-loaded with `React.lazy`
- **Edge-first AI**: All AI processing happens in Edge Functions, never client-side
- **Model-agnostic AI**: The AI engine abstracts away specific model providers

---

## AI Engine

The `burs-ai.ts` shared module is the core IP of the platform. It provides:

### Complexity-Based Model Routing
```
trivial  → gemini-2.5-flash-lite → gemini-2.5-flash
standard → gemini-3-flash-preview → gemini-2.5-flash → gemini-2.5-flash-lite
complex  → gemini-2.5-pro → gemini-3-flash-preview → gemini-2.5-flash
```

Each complexity level auto-configures:
- **Model chain** (ordered fallback list)
- **Token budget** (300 / 600 / 1200)
- **Temperature** (0.1 / 0.3 / 0.5)

### Features
- **DB-backed caching** via `ai_response_cache` table with configurable TTL
- **Request deduplication** to prevent duplicate in-flight requests
- **Retry with backoff** across model chain
- **Prompt compression** to reduce token usage
- **Smart token estimation** based on input/output item count
- **Rate limiting** per user per function (via `ai_rate_limits` table)
- **Streaming support** with keepalive headers
- **Observability logging** for debugging and monitoring

### Usage in Edge Functions
```typescript
import { callBursAI, checkRateLimit } from "../_shared/burs-ai.ts";

// Check rate limit first
await checkRateLimit(supabaseAdmin, userId, "generate_outfit", 30);

// Call AI with automatic model routing
const result = await callBursAI({
  messages: [{ role: "system", content: "..." }],
  complexity: "standard",
  tools: [toolDefinition],
  tool_choice: { type: "function", function: { name: "select_outfit" } },
  cacheTtlSeconds: 3600,
  cacheNamespace: "outfit-gen",
  functionName: "generate_outfit",
});
```

---

## Data Flow

### Outfit Generation Flow
```
User Request → Edge Function → Rate Limit Check → Cache Check
  → (miss) → Build Prompt (garments + weather + preferences + history)
  → callBursAI (complexity: standard)
  → Model Chain: try gemini-3-flash → fallback gemini-2.5-flash
  → Parse Tool Call Response → Validate Garment IDs
  → Cache Response → Return to Client
```

### Wardrobe Upload Flow
```
User Photo → Client Upload to Storage → Edge Function: analyze_garment
  → callBursAI (complexity: complex, vision model)
  → Extract: category, color, material, pattern, formality, season
  → Update garments table → Trigger: update_garments_count
  → Return analysis to client
```

---

## Billing Flow

```
User → create_checkout_session → Stripe Checkout
  → (success) → stripe_webhook → Update subscriptions table
  → (cancel) → No action

Subscription Check:
  Client → restore_subscription → Check Stripe API → Update DB → Return status

Management:
  Client → create_portal_session → Stripe Customer Portal
```

### Multi-Currency Support
Locale-based price mapping for: SEK, EUR, USD, NOK, DKK, GBP, CHF

### Rate Limiting
Checkout attempts are rate-limited per user (max 5 per hour via `checkout_attempts` table).

---

## Security Model

### Authentication
- Email + password via Supabase Auth
- JWT validated in all sensitive edge functions using `getClaims()`
- Session management with "remember me" support

### Authorization
- **RLS**: 80+ Row Level Security policies
- **RBAC**: `user_roles` table with `app_role` enum (admin, moderator, user)
- **Security Definer Functions**: `has_role()` and `is_admin()` prevent RLS recursion
- **Subscription mutations**: Server-side only (no client UPDATE on `user_subscriptions`)

### Data Protection
- Private storage buckets (garments, avatars, body-images)
- Signed URLs for image access (1-hour expiry)
- SSRF protection on external URL fetching
- Stripe webhook signature verification

### Edge Function Auth Pattern
All edge functions use `verify_jwt = false` in config and validate internally:
```typescript
const { data, error } = await supabase.auth.getClaims(token);
const userId = data.claims.sub;
```

Public functions (webhooks, VAPID key retrieval) skip JWT validation but implement
signature verification or are read-only.

---

## Edge Functions Reference

| Function | Purpose | Auth | Rate Limited |
|----------|---------|------|-------------|
| `analyze_garment` | AI garment analysis from photo | JWT | Yes |
| `generate_outfit` | AI outfit generation | JWT | Yes |
| `style_chat` | AI stylist conversation | JWT | Yes |
| `mood_outfit` | Mood-based outfit generation | JWT | Yes |
| `visual_search` | Photo-based wardrobe matching | JWT | Yes |
| `smart_shopping_list` | AI shopping recommendations | JWT | Yes |
| `wardrobe_aging` | Garment lifespan predictions | JWT | Yes |
| `style_twin` | Style archetype matching | JWT | Yes |
| `generate_flatlay` | AI flat-lay image generation | JWT | Yes |
| `outfit_photo_feedback` | AI outfit selfie feedback | JWT | Yes |
| `suggest_accessories` | AI accessory suggestions | JWT | Yes |
| `suggest_outfit_combinations` | AI outfit combo ideas | JWT | Yes |
| `clone_outfit_dna` | Clone outfit style | JWT | Yes |
| `wardrobe_gap_analysis` | Wardrobe gap detection | JWT | Yes |
| `assess_garment_condition` | AI condition scoring | JWT | Yes |
| `burs_style_engine` | Comprehensive style analysis | JWT | Yes |
| `summarize_day` | Daily outfit summary | JWT | Yes |
| `travel_capsule` | Travel packing AI | JWT | Yes |
| `shopping_chat` | Shopping assistant chat | JWT | Yes |
| `seed_wardrobe` | Demo wardrobe seeding | JWT | No |
| `generate_garment_images` | AI garment image gen | JWT | Yes |
| `prefetch_suggestions` | Cron: pre-cache suggestions | Service | No |
| `cleanup_ai_cache` | Cron: purge expired cache | Service | No |
| `daily_reminders` | Cron: push notifications | Service | No |
| `create_checkout_session` | Stripe checkout | JWT | Yes (5/hr) |
| `create_portal_session` | Stripe portal | JWT | No |
| `restore_subscription` | Sync Stripe status | JWT | No |
| `stripe_webhook` | Stripe event handler | Signature | No |
| `delete_user_account` | GDPR account deletion | JWT | No |
| `calendar` | ICS calendar sync | JWT | No |
| `google_calendar_auth` | Google OAuth flow | JWT | No |
| `import_garments_from_links` | URL garment import | JWT | No |
| `detect_duplicate_garment` | Duplicate detection | JWT | No |
| `get_vapid_public_key` | Push notification key | Public | No |
| `send_push_notification` | Send push notification | Service | No |
| `auth-email-hook` | Custom email templates | Hook | No |
