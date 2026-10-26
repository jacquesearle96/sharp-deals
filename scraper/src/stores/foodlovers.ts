import { createLeafletAdapter } from '../leaflet.ts';

/**
 * Food Lover's Market publishes its specials only as leaflet pages on its own site, so the item-level
 * listing comes from the leaflet aggregator (see leaflet.ts).
 */
export const foodlovers = createLeafletAdapter('foodlovers', 'food-lover-s-market');
