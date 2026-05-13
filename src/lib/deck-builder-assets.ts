import { DECK_BUILDER_CARD_IMAGE_BY_ID } from '@/pages/deck-builder/data/deck-builder-card-images'
import type { CardEntry } from '@/lib/types'
import type { DeckBuilderDivineGod } from '@/pages/deck-builder/deck-builder.types'

const combatantCardImages = import.meta.glob(
  '../pages/deck-builder/data/combatants/**/*.{webp,png,jpg,jpeg,avif}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>

const neutralAndMonsterCardImages = import.meta.glob(
  '../pages/deck-builder/data/neutral-cards/**/*.{webp,png,jpg,jpeg,avif}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>

const divineGodImages = import.meta.glob(
  '../pages/deck-builder/data/divine-gods/*.{webp,png,jpg,jpeg,avif}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>

const personaCardImages = import.meta.glob(
  '../pages/deck-builder/data/persona/*.{webp,png,jpg,jpeg,avif}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>

const cardImages = {
  ...combatantCardImages,
  ...neutralAndMonsterCardImages,
}

const faceImages = import.meta.glob(
  '../../api/assets/game/faces/*.{webp,png,jpg,jpeg,avif}',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
) as Record<string, string>

const mappedCardImages = DECK_BUILDER_CARD_IMAGE_BY_ID as Record<string, string>

const warnedMissingCardImages = new Set<string>()
const warnedMissingCharacterFaces = new Set<number | string>()
const warnedMissingDivineGodIcons = new Set<string>()
const warnedMissingPersonaImages = new Set<string>()

function normalizePath(value: string) {
  return value.replace(/\\/g, '/').toLowerCase()
}

function getBaseCardId(cardId: string) {
  return cardId.replace(/_epiphany_\d+$/i, '')
}

function findAssetUrl(fileNameOrPath: string, assets: Record<string, string>) {
  const normalizedFileNameOrPath = normalizePath(fileNameOrPath)

  const key = Object.keys(assets).find(path =>
    normalizePath(path).endsWith(`/${normalizedFileNameOrPath}`),
  )

  return key ? assets[key] : null
}

function getCardImageCandidates(cardId: string) {
  const baseCardId = getBaseCardId(cardId)

  const ids = Array.from(new Set([cardId, baseCardId]))

  const extensions = ['webp', 'png', 'jpg', 'jpeg', 'avif']

  return ids.flatMap(id => extensions.map(extension => `${id}.${extension}`))
}

function getMappedCardImagePath(cardId: string) {
  const directPath = mappedCardImages[cardId]

  if (directPath) {
    return directPath
  }

  const baseCardId = getBaseCardId(cardId)

  return mappedCardImages[baseCardId] ?? null
}

function warnMissingCardImage(card: CardEntry, fileName?: string) {
  if (!import.meta.env.DEV) {
    return
  }

  if (warnedMissingCardImages.has(card.card_id)) {
    return
  }

  warnedMissingCardImages.add(card.card_id)

  if (!fileName) {
    console.warn(
      `[Deck Builder] Carta sem imagem encontrada: ${card.card_id} - ${card.name}`,
    )
    return
  }

  console.warn(
    `[Deck Builder] Imagem mapeada não encontrada: ${card.card_id} - ${card.name} -> ${fileName}`,
  )
}

function warnMissingCharacterFace(charResId: number | string) {
  if (!import.meta.env.DEV) {
    return
  }

  if (warnedMissingCharacterFaces.has(charResId)) {
    return
  }

  warnedMissingCharacterFaces.add(charResId)

  console.warn(
    `[Deck Builder] Avatar de combatente não encontrado: ${charResId}`,
  )
}

function warnMissingDivineGodIcon(god: DeckBuilderDivineGod) {
  if (!import.meta.env.DEV) {
    return
  }

  if (warnedMissingDivineGodIcons.has(god.id)) {
    return
  }

  warnedMissingDivineGodIcons.add(god.id)

  console.warn(
    `[Deck Builder] Ícone de Divine God não encontrado: ${god.id}`,
  )
}

function warnMissingPersonaImage(fileNameOrPath: string) {
  if (!import.meta.env.DEV) {
    return
  }

  if (warnedMissingPersonaImages.has(fileNameOrPath)) {
    return
  }

  warnedMissingPersonaImages.add(fileNameOrPath)

  console.warn(
    `[Deck Builder] Imagem de Persona não encontrada: ${fileNameOrPath}`,
  )
}

export function getCharacterFaceUrl(charResId: number | string) {
  const imageUrl = findAssetUrl(
    `bookmark_face_character_map_${charResId}.png`,
    faceImages,
  )

  if (!imageUrl) {
    warnMissingCharacterFace(charResId)
  }

  return imageUrl
}

export function getCardImageUrl(card: CardEntry) {
  const candidates = getCardImageCandidates(card.card_id)

  for (const candidate of candidates) {
    const imageUrl = findAssetUrl(candidate, cardImages)

    if (imageUrl) {
      return imageUrl
    }
  }

  const mappedPath = getMappedCardImagePath(card.card_id)

  if (!mappedPath) {
    warnMissingCardImage(card)
    return null
  }

  const mappedImageUrl = findAssetUrl(mappedPath, cardImages)

  if (!mappedImageUrl) {
    warnMissingCardImage(card, mappedPath)
    return null
  }

  return mappedImageUrl
}

export function getDivineGodIconUrl(god: DeckBuilderDivineGod) {
  const imageUrl = findAssetUrl(`${god.id.toLowerCase()}.webp`, divineGodImages)

  if (!imageUrl) {
    warnMissingDivineGodIcon(god)
  }

  return imageUrl
}

export function getDeckBuilderPersonaImageUrl(fileNameOrPath: string | null | undefined) {
  if (!fileNameOrPath) {
    return null
  }

  const imageUrl = findAssetUrl(fileNameOrPath, personaCardImages)

  if (!imageUrl) {
    warnMissingPersonaImage(fileNameOrPath)
  }

  return imageUrl
}
