import { getCardImageUrl, getDeckBuilderPersonaImageUrl } from '@/lib/deck-builder-assets'
import type { CardEntry } from '@/lib/types'
import { DECK_BUILDER_PERSONA_IMAGE_OVERRIDE_FIELD } from '../deck-builder.utils'

type CardImageProps = {
  card: CardEntry
  variant?: 'cover' | 'contain'
  className?: string
}

type CardEntryWithPersonaImageOverride = CardEntry & {
  [DECK_BUILDER_PERSONA_IMAGE_OVERRIDE_FIELD]?: string | null
}

function getCardImageSource(card: CardEntry) {
  const personaImageOverridePath = (card as CardEntryWithPersonaImageOverride)[
    DECK_BUILDER_PERSONA_IMAGE_OVERRIDE_FIELD
  ]

  if (personaImageOverridePath) {
    return getDeckBuilderPersonaImageUrl(personaImageOverridePath) ?? getCardImageUrl(card)
  }

  return getCardImageUrl(card)
}

export function CardImage({ card, variant = 'cover', className = '' }: CardImageProps) {
  const imageUrl = getCardImageSource(card)

  if (!imageUrl) {
    return (
      <div
        className={`grid place-items-center rounded-lg bg-[#1f1f2a] text-center text-[10px] font-bold uppercase tracking-wide text-[#777] ${className}`}
      >
        No image
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={card.name}
      loading="lazy"
      draggable={false}
      className={`block ${variant === 'cover' ? 'object-cover' : 'object-contain'} ${className}`}
    />
  )
}
