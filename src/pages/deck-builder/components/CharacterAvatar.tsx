import { useState } from 'react'
import { Plus } from 'lucide-react'
import { getCharacterFaceUrl } from '@/lib/deck-builder-assets'
import type { CardCharacter } from '@/lib/types'

export function CharacterAvatar({
  character,
}: {
  character: CardCharacter | undefined
}) {
  const [hasError, setHasError] = useState(false)

  if (!character) {
    return (
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#333348] bg-[#101018] text-[#777]">
        <Plus size={16} />
      </div>
    )
  }

  const imageUrl = getCharacterFaceUrl(character.char_res_id)

  if (!imageUrl || hasError) {
    return (
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#333348] bg-[#101018] text-xs font-bold text-[#c084fc]">
        {character.name?.slice(0, 1) ?? '?'}
      </div>
    )
  }

  return (
    <img
      src={imageUrl}
      alt={character.name ?? `Combatente ${character.char_res_id}`}
      loading="lazy"
      draggable={false}
      onError={() => setHasError(true)}
      className="h-10 w-10 shrink-0 rounded-lg border border-[#333348] object-cover"
    />
  )
}
