# BURS — AI-Powered Wardrobe & Styling Platform

BURS is a premium fashion-tech platform that helps users digitize their wardrobe, generate smart outfits, plan what to wear, and get AI styling assistance. Think of it as a personal styling operating system.

🌐 **Live**: [burs.me](https://burs.me)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React/Vite)                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Wardrobe │  │ Outfits  │  │ Planner  │  │ AI Chat │ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│        ↓              ↓            ↓            ↓       │
│  ┌──────────────────────────────────────────────────┐   │
│  │         React Query (Offline-First Cache)        │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase (Backend)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │   Auth   │  │    DB    │  │ Storage  │  │   Edge  │ │
│  │ (Email)  │  │ (25 tbl) │  │ (Images) │  │Functions│ │
│  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │
│                                                 ↓       │
│  ┌──────────────────────────────────────────────────┐   │
│  │     BURS AI Engine (burs-ai.ts)                  │   │
│  │  Complexity routing · Model chains · DB caching  │   │
│  │  Retry/backoff · Token budgets · Rate limits     │   │
│  └──────────────────────────────────────────────────┘   │
│                          ↓                              │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Google AI / model APIs              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Stripe (Billing)                      │
│  Checkout · Webhooks · Customer Portal · Multi-currency │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 5 |
| Styling | Tailwind CSS + shadcn/ui |
| State | TanStack React Query (offline-first) |
| Auth | Supabase Auth (email + password) |
| Database | PostgreSQL via Supabase (25 tables, 80+ RLS policies) |
| Storage | Supabase Storage (private buckets) |
| Backend | 36 Supabase Edge Functions (Deno) |
| AI | Custom abstraction layer with complexity-based model routing |
| Billing | Stripe (subscriptions, webhooks, customer portal) |
| Animations | Framer Motion |
| PWA | Service worker, manifest, push notifications |
| i18n | Custom translation system (EN, SV, NO, DA, FI, DE, FR, ES) |

## Key Features

- **Wardrobe Management** — Upload, categorize, and organize clothing with AI analysis
- **AI Outfit Generation** — Context-aware suggestions based on weather, occasion, and calendar
- **Weekly Planning** — 7-day outfit planner with calendar integration
- **AI Style Chat** — Personal stylist assistant powered by the BURS AI Engine
- **Smart Shopping** — Wardrobe gap analysis and personalized recommendations
- **Social** — Public profiles, outfit sharing, reactions, style challenges
- **Insights** — Wear heatmaps, spending dashboards, style reports

## Local Development

### Prerequisites

- Node.js 18+ (install via [nvm](https://github.com/nvm-sh/nvm))
- npm 9+

### Setup

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd burs

# Install dependencies
npm install

# Start development server
npm run dev
```

The app runs at `http://localhost:8080`.

### Environment Variables

The frontend expects the Supabase runtime config below in `.env`; startup now fails fast if either required value is missing.

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL used by the shared frontend client |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/public key used by the shared frontend client |
| `VITE_SUPABASE_PROJECT_ID` | No | Optional project identifier for tooling or diagnostics |
| `BURS_APP_URL` | No (Edge env) | Canonical frontend origin for Stripe/app redirects when the request origin is absent or does not match a BURS/Vercel preview origin |

Edge functions still require additional secrets configured in the Supabase dashboard or function environment. For the active stylist, shopping, and garment-analysis flows, set `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. `LOVABLE_API_KEY` is not used by the current production code paths. Other functions may also need Stripe keys, VAPID keys, Google OAuth credentials, etc.


### Required Storage Setup

The wardrobe/photo flows expect a private Supabase Storage bucket named `garments` with authenticated per-user access scoped to the first path segment (`<user-id>/...`). This repo now includes a migration that creates the bucket plus insert/select/update/delete policies, so `supabase db push` reproduces the required storage setup for image upload, stylist image chat, live scan saves, and add-garment-by-photo.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with HMR |
| `npm run build` | Production build |
| `npm run lint` | ESLint check |
| `npm run test` | Run test suite |
| `npm run preview` | Preview production build |

## Project Structure

```
src/
├── components/       # UI components (159 components)
│   ├── ui/           # shadcn/ui primitives
│   ├── layout/       # App shell, navigation, skeletons
│   ├── wardrobe/     # Wardrobe management
│   ├── outfit/       # Outfit generation & display
│   ├── plan/         # Weekly planner
│   ├── chat/         # AI stylist chat
│   ├── insights/     # Analytics dashboards
│   ├── home/         # Home screen widgets
│   └── ...
├── pages/            # Route pages (46 pages)
├── hooks/            # Custom hooks (36 hooks)
├── contexts/         # React contexts (Auth, Theme, Language, Location, Seed)
├── integrations/     # Supabase client & types
├── lib/              # Utilities, haptics, motion, offline queue
├── i18n/             # Translation strings
└── assets/           # Static assets

supabase/
├── functions/        # 36 Edge Functions
│   ├── _shared/      # Shared utilities (burs-ai.ts, cors.ts, stripe-config.ts)
│   ├── generate_outfit/
│   ├── style_chat/
│   ├── stripe_webhook/
│   └── ...
└── config.toml       # Edge function configuration
```

## Security

- **Row Level Security (RLS)** on all tables (80+ policies)
- **RBAC** via `user_roles` table with security-definer functions
- **JWT validation** in all sensitive edge functions
- **SSRF protection** on external URL fetching
- **Rate limiting** on AI and billing endpoints
- **Stripe webhook signature** verification
- **Private storage buckets** for user images

## Deployment

The frontend is built with Vite and can be deployed to any static host. Supabase handles backend services, and Edge Functions / database changes are deployed through the Supabase toolchain you use for your environment.

## License

Proprietary. All rights reserved.
