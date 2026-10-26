import type { Product } from '../../../shared/types.ts';
import { createLeafletAdapter, endDate, mapLeafletCard, type CardText } from '../leaflet.ts';

export { endDate };
export type { CardText };

/** checkers.co.za blocks automated access, so Checkers specials come from the leaflet aggregator (see leaflet.ts). */
export const mapCard = (card: CardText, scrapedAt: string): Product | null => mapLeafletCard(card, 'checkers', scrapedAt);

export const checkers = createLeafletAdapter('checkers', 'checkers');
