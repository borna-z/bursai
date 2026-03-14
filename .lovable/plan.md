

# Robots.txt Cleanup

## 1. `Disallow: /auth` — Remove it

You're right. The `/auth` page is your **signup/login page** — it's the destination of every CTA on the landing page and public profiles. Blocking it from crawlers means:

- Google can't follow "Sign Up" links, which hurts link equity and crawl flow
- Social crawlers (already allowed above) can reach it, but generic bots can't
- There's no sensitive content on `/auth` — it's a public form

The `/admin` disallow makes sense (admin panel shouldn't be indexed). But `/auth` should be crawlable.

**Action:** Remove `Disallow: /auth` line.

## 2. Sitemap domain — You're correct

The sitemap points to `https://aigarderob.se/sitemap.xml`. If the live domain is now `burs.me`, then:

- Lighthouse will flag it as unreachable (if `aigarderob.se` doesn't resolve or doesn't serve a sitemap)
- Google Search Console will also report the sitemap as inaccessible
- It should point to `https://burs.me/sitemap.xml`

However — there's no `sitemap.xml` file in the `public/` folder either. So even after fixing the domain, the URL would 404 unless a sitemap file is created.

**Action:** Update domain to `https://burs.me/sitemap.xml` and create a basic `public/sitemap.xml` with the key public routes (landing, pricing, auth, privacy, terms, contact).

## Files to edit

1. **`public/robots.txt`** — Remove `Disallow: /auth`, update sitemap URL to `https://burs.me/sitemap.xml`
2. **`public/sitemap.xml`** (new) — Create with key public routes

