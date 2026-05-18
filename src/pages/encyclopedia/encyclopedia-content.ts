import rawContent from './data/encyclopedia-content.json'
import type {
  Clarification,
  ClarificationKind,
  EncyclopediaContent,
  GlossaryEntry,
} from './encyclopedia.types'
import { buildMatcher } from './encyclopedia.utils'

// Cast is safe at the top level (resolveJsonModule infers the shape); the
// vitest content-shape tests guard the enum/union fields at runtime.
const content = rawContent as EncyclopediaContent

export const GLOSSARY: GlossaryEntry[] = content.glossary
export const CLARIFICATIONS: Clarification[] = content.clarifications

export const glossaryById = new Map(GLOSSARY.map(entry => [entry.id, entry]))

/** Prebuilt matcher over the whole glossary — built once at module load. */
export const matcher = buildMatcher(GLOSSARY)

const clarificationIndex = new Map(
  CLARIFICATIONS.map(c => [`${c.kind}:${c.refId}`, c]),
)

/** Returns the hand-written clarification for an entry, if one exists. */
export function findClarification(
  kind: ClarificationKind,
  refId: string,
): Clarification | undefined {
  return clarificationIndex.get(`${kind}:${refId}`)
}
