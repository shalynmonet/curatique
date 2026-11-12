import type { C3Product } from "./types";

// Audience rules: shoppers get adult items unless they ask for children's items, and gendered
// garments default to their usual audience (dresses -> women, suits -> men) unless told otherwise.

const KID_INTENT =
  /\b(kids?|kid's|child|children|children's|girls?|girl's|boys?|boy's|baby|babies|toddlers?|infants?|newborns?|youth|juniors?|teens?|tweens?|little (girls?|boys?|ones?)|preschool(ers?)?|(?:[1-9]|1[0-7])[- ]?(?:year|yr)s?[- ]?olds?)\b/i;
// Family words set the gender but not the age (an adult daughter wants adult clothes).
const WOMEN =
  /\b(women|women's|womens|woman|ladies|lady|female|her|hers|girls?|wife|girlfriend|mom|mother|sister|daughters?|nieces?|granddaughters?)\b/i;
const MEN = /\b(men|men's|mens|man|gentlemen|gents?|male|his|boys?|husband|boyfriend|dad|father|brother|sons?|nephews?|grandsons?)\b/i;
// Garments that default to women unless men are named.
const WOMEN_ITEMS =
  /\b(dress|dresses)\b(?!\s+(shirts?|shoes|pants|trousers|socks|watch(es)?))|\b(gowns?|skirts?|heels|high heels|stilettos?|pumps|kitten heels|blouses?|bras?|bralettes?|lingerie|bikinis?|camisoles?|rompers?|maternity|tights|stockings|sundress(es)?|minidress(es)?|maxi dress(es)?|midi dress(es)?)\b/i;
// Garments that default to men unless women are named.
const MEN_ITEMS = /\b(suits?|tuxedos?|tux|boxers?|boxer briefs|briefs|cufflinks|dress shirts?|neckties?|bow ties?)\b/i;

export interface Audience {
  kids: boolean;
  gender?: "male" | "female";
}

/** Work out who a search is for from its words. */
export function audienceFor(text: string): Audience {
  const kids = KID_INTENT.test(text);
  const saysWomen = WOMEN.test(text);
  const saysMen = MEN.test(text);
  let gender: Audience["gender"];
  if (saysWomen && !saysMen) gender = "female";
  else if (saysMen && !saysWomen) gender = "male";
  else if (!saysWomen && !saysMen) {
    const w = WOMEN_ITEMS.test(text), m = MEN_ITEMS.test(text);
    if (w && !m) gender = "female";
    else if (m && !w) gender = "male";
  }
  return { kids, gender };
}

/** Channel3 search filters for an audience. */
export function audienceFilters(a: Audience): Record<string, unknown> {
  return { ...(!a.kids && { age: ["adult"] }), ...(a.gender && { gender: a.gender }) };
}

const KID_CATEGORY = /\b(baby|babies|toddler|kids?|girls?|boys?|child|children|infant|newborn|youth|junior)\b/i;
const KID_SIZE = /\b(\d{1,2}T|\d{1,2}\s?-\s?\d{1,2}\s?(m|mo|mos|months|y|yrs|years)|\d{1,2}\s?(mos|months))\b/i;

/** Safety net for products Channel3 hasn't age-tagged: category, title words and kids' sizes. */
export function looksLikeKids(p: C3Product): boolean {
  if (p.age && p.age !== "adult") return true;
  const cat = [p.category?.title, ...(p.category?.path?.map((c) => c.title) ?? [])].filter(Boolean).join(" ");
  if (KID_CATEGORY.test(cat)) return true;
  return KID_INTENT.test(p.title) || KID_SIZE.test(p.title);
}

/** Keep only products that fit the audience. */
export function fitsAudience(p: C3Product, a: Audience): boolean {
  if (!a.kids && looksLikeKids(p)) return false;
  if (a.gender && p.gender && p.gender !== a.gender) return false;
  return true;
}

export const AUDIENCE_RULE =
  "Audience rule: recommend adult items only, unless the shopper or niche explicitly asks for children's items (kids, girls, boys, baby, toddler). " +
  "Typically women's items (dresses, skirts, heels, blouses, lingerie) are for adult women and typically men's items (suits, tuxedos, boxers, dress shirts) are for adult men, " +
  "unless the shopper names another audience. Never include baby, toddler or kids' items otherwise.";
