import type { StoreId } from '../../../shared/types.ts'

export interface StoreInfo {
  id: StoreId
  name: string
  /** Brand-ish colour for the chip dot */
  color: string
}

export const STORE_INFO: Record<StoreId, StoreInfo> = {
  pnp: { id: 'pnp', name: 'Pick n Pay', color: '#1e6bd6' },
  checkers: { id: 'checkers', name: 'Checkers', color: '#e1251b' },
  woolworths: { id: 'woolworths', name: 'Woolworths', color: '#1f2937' },
  spar: { id: 'spar', name: 'Spar', color: '#0a9b4b' },
  clicks: { id: 'clicks', name: 'Clicks', color: '#0099cc' },
  dischem: { id: 'dischem', name: 'Dis-Chem', color: '#00a19b' },
  babycity: { id: 'babycity', name: 'Baby City', color: '#ec4899' },
  babiesrus: { id: 'babiesrus', name: 'Babies R Us', color: '#0ea5e9' },
  evetech: { id: 'evetech', name: 'Evetech', color: '#0f766e' },
  takealot: { id: 'takealot', name: 'Takealot', color: '#0b79bf' },
  incredible: { id: 'incredible', name: 'Incredible Connection', color: '#7c3aed' },
}
