import { useState } from 'react'
import { getCardImageUrl } from '@/lib/deck-builder-assets'
import type { CardEntry } from '@/lib/types'

type CardImageVariant = 'cover' | 'thumbnail' | 'contain'

export function CardImage({
  card,
  className = '',
  variant = 'cover',
}: {
  card: CardEntry
  className?: string
  variant?: CardImageVariant
}) {
  const [hasError, setHasError] = useState(false)
  const imageUrl = getCardImageUrl(card)

  if (!imageUrl || hasError) {
    return (
      <div
        className={[
          'flex h-full w-full items-center justify-center bg-[#11111a] text-[10px] text-[#666]',
          className,
        ].join(' ')}
      >
        Sem imagem
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={card.name}
      loading="lazy"
      draggable={false}
      onError={() => setHasError(true)}
      className={[
        'h-full w-full',
        variant === 'contain'
          ? 'object-contain'
          : variant === 'cover'
            ? 'object-cover object-top'
            : 'object-cover',
        className,
      ].join(' ')}
    />
  )
}
