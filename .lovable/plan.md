

## Update Link Preview Text from Swedish to English

When you share the BURS link (e.g. on iMessage, WhatsApp, Slack), the preview currently shows Swedish text like "Din personliga stylist". This needs to be changed to English.

### What will change

**`index.html`** -- Update all Swedish meta tags to English:

| Tag | Current (Swedish) | New (English) |
|---|---|---|
| `html lang` | `sv` | `en` |
| `title` | BURS \| Din personliga stylist | BURS \| Your Personal Stylist |
| `description` | BURS -- din AI-stylist som lar kanna din kropp... | BURS -- your AI stylist that learns your body, style and calendar to suggest outfits that fit your day. |
| `og:title` | BURS \| Din personliga stylist | BURS \| Your Personal Stylist |
| `og:description` | BURS -- din AI-stylist som lar kanna din stil... | BURS -- your AI stylist that learns your style and calendar to suggest the right outfit every day. |
| `og:locale` | sv_SE | en_US |
| `twitter:title` | BURS \| Din personliga stylist | BURS \| Your Personal Stylist |
| `twitter:description` | Swedish | Same English as og:description |

Only one file changes. After publishing, link previews may take some time to update due to caching by iMessage, WhatsApp, etc.
