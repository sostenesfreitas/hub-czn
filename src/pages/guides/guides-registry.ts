import { GUIDES } from './guides-content'
import type { Guide } from './guides.types'

export interface GuideListEntry {
  charResId: number
  name: string
}

export const GUIDE_LIST: GuideListEntry[] = GUIDES.map((g: Guide) => ({
  charResId: g.charResId,
  name: g.name,
}))
