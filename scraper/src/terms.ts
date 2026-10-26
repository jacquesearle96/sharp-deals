/** Search terms that together sweep the grocery aisles. */
export const TERMS = [
  'milk', 'bread', 'eggs', 'butter', 'cheese', 'yoghurt', 'cream', 'chicken', 'beef', 'pork', 'sausage',
  'bacon', 'fish', 'rice', 'pasta', 'flour', 'sugar', 'oil', 'cereal', 'oats', 'coffee', 'tea', 'juice',
  'cooldrink', 'water', 'beer', 'wine', 'chocolate', 'sweets', 'chips', 'biscuits', 'nuts', 'fruit',
  'vegetables', 'frozen', 'ice cream', 'pizza', 'soup', 'sauce', 'tinned', 'toilet paper', 'detergent',
  'dishwashing', 'cleaning', 'toothpaste', 'shampoo', 'soap', 'deodorant', 'nappies', 'baby food',
  'dog food', 'cat food',
];

/** Optional override for quick test runs, e.g. SCRAPE_TERMS=milk,bread */
export const activeTerms = (process.env.SCRAPE_TERMS?.split(",").map((t) => t.trim()).filter(Boolean)) ?? TERMS;
