import tenebriaJson from './data/tenebria.guide.json'
import type { Guide } from './guides.types'

export const TENEBRIA_GUIDE = tenebriaJson as Guide

export const GUIDES: Guide[] = [TENEBRIA_GUIDE]

export function getGuide(charResId: number): Guide | undefined {
  return GUIDES.find(g => g.charResId === charResId)
}
