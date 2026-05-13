export type FormattedCardDescription = {
  tags: string[]
  text: string
}

function normalizeDisplayTag(value: string | null | undefined) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

function normalizeDisplayTagKey(value: string | null | undefined) {
  return normalizeDisplayTag(value).toLowerCase()
}

export function getUniqueDisplayTags(
  values: readonly (string | null | undefined)[],
) {
  const tags: string[] = []
  const seenTags = new Set<string>()

  values.forEach(value => {
    const tag = normalizeDisplayTag(value)

    if (!tag) {
      return
    }

    const key = normalizeDisplayTagKey(tag)

    if (seenTags.has(key)) {
      return
    }

    seenTags.add(key)
    tags.push(tag)
  })

  return tags
}

export function mergeCardDisplayTags(
  ...groups: Array<readonly (string | null | undefined)[] | null | undefined>
) {
  return getUniqueDisplayTags(groups.flatMap(group => group ?? []))
}

export function formatCardDisplayDescription(
  value: string | null | undefined,
): FormattedCardDescription {
  const normalizedDescription = String(value ?? '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(part => part.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  const tags = getUniqueDisplayTags(
    Array.from(normalizedDescription.matchAll(/\[([^\]]+)\]/g))
      .map(match => match[1]),
  )

  const text = normalizedDescription
    .replace(/\[[^\]]+\]\s*/g, '')
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

  return {
    tags,
    text: text || normalizedDescription,
  }
}
