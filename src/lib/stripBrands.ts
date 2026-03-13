/**
 * Strips common fashion brand names from garment titles for a cleaner display.
 * E.g. "Levi's 501 Original Fit Jeans" → "Original Fit Jeans"
 */

const BRAND_NAMES = [
  "Nike", "Adidas", "Puma", "Reebok", "New Balance", "Converse", "Vans",
  "Levi's", "Levis", "Levi", "Wrangler", "Lee", "Diesel",
  "Zara", "H&M", "HM", "Uniqlo", "Mango", "ASOS", "Primark",
  "Gucci", "Prada", "Louis Vuitton", "LV", "Chanel", "Dior", "Hermès", "Hermes",
  "Versace", "Balenciaga", "Burberry", "Fendi", "Givenchy", "Valentino",
  "Saint Laurent", "YSL", "Bottega Veneta", "Celine", "Céline", "Loewe",
  "Ralph Lauren", "Tommy Hilfiger", "Calvin Klein", "CK", "Hugo Boss", "Boss",
  "Lacoste", "Fred Perry", "Gant", "J.Crew", "Massimo Dutti", "COS",
  "The North Face", "Patagonia", "Arc'teryx", "Columbia",
  "Dr. Martens", "Timberland", "Birkenstock", "Clarks",
  "Under Armour", "Asics", "Saucony", "Hoka", "On Running",
  "Acne Studios", "Filippa K", "Tiger of Sweden", "Nudie Jeans", "Nudie",
  "Carhartt", "Dickies", "Stüssy", "Stussy", "Supreme",
  "Weekday", "Arket", "& Other Stories", "Other Stories", "Monki",
  "Gap", "Old Navy", "Banana Republic", "American Eagle", "Abercrombie",
  "Hollister", "Pull & Bear", "Pull&Bear", "Bershka", "Stradivarius",
  "Nike Air", "Air Jordan", "Jordan",
];

const brandPattern = new RegExp(
  `\\b(${BRAND_NAMES.map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})('s)?\\b\\s*`,
  'gi'
);

/** Strip known brand names from a garment title, cleaning up leftover whitespace. */
export function stripBrands(title: string): string {
  if (!title) return title;
  const cleaned = title
    .replace(brandPattern, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—·,]+/, '') // trim leading separators
    .trim();
  // If stripping removed everything, return original
  return cleaned || title;
}
