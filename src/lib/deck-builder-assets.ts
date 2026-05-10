import type { CardEntry } from '@/lib/types'

const cardImages = import.meta.glob('../../api/assets/cards/*.{webp,png,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const faceImages = import.meta.glob('../../api/assets/game/faces/*.{webp,png,jpg,jpeg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function findAssetUrl(fileName: string, assets: Record<string, string>) {
  const normalizedFileName = fileName.replace(/\\/g, '/')

  const key = Object.keys(assets).find(path =>
    path.replace(/\\/g, '/').endsWith(`/${normalizedFileName}`),
  )

  return key ? assets[key] : null
}

function getBaseCardId(cardId: string) {
  return cardId.replace(/_epiphany_\d+$/i, '')
}

function twoDigits(value: string | number) {
  return String(value).padStart(2, '0')
}

export function getCharacterFaceUrl(charResId: number | string) {
  return findAssetUrl(
    `bookmark_face_character_map_${charResId}.png`,
    faceImages,
  )
}

export function getCardImageUrl(card: CardEntry) {
  const baseCardId = getBaseCardId(card.card_id)

  const match = baseCardId.match(/^c_(\d+)_(srt|uni|eps|col)(\d*)$/i)

  if (!match) {
    return null
  }

  const [, charResId, cardGroup, rawIndex] = match

  if (cardGroup === 'srt') {
    return findAssetUrl(
      `start_${charResId}_${twoDigits(rawIndex || 1)}.webp`,
      cardImages,
    )
  }

  if (cardGroup === 'uni') {
    return findAssetUrl(
      `unique_${charResId}_${twoDigits(rawIndex || 1)}.webp`,
      cardImages,
    )
  }

  if (cardGroup === 'eps') {
    return findAssetUrl(
      `collapse_${charResId}_01.webp`,
      cardImages,
    )
  }

  if (cardGroup === 'col') {
    return findAssetUrl(
      `collapse_${charResId}_${twoDigits(rawIndex || 1)}.webp`,
      cardImages,
    )
  }

  return null
}