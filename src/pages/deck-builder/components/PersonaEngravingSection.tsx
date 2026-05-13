import { useMemo, useState, type ReactNode } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CardEntry } from '@/lib/types'
import {
  filterPersonaEngravings,
  resolvePersonaEngravingCardType,
} from '../deck-builder-persona-engraving.utils'
import type {
  DeckBuilderEpiphanyVariant,
  DeckBuilderPersonaEngraving,
  DeckBuilderPersonaEngravingSelection,
} from '../deck-builder.types'

type PersonaEngravingSlot = keyof DeckBuilderPersonaEngravingSelection

type PersonaEngravingSectionProps = {
  card: CardEntry
  selectedVariant: DeckBuilderEpiphanyVariant | null
  combatantClass?: string | null
  selectedPersonaEngravings: DeckBuilderPersonaEngravingSelection
  onChange: (selection: DeckBuilderPersonaEngravingSelection) => void
}

type BadgeTone = 'lux' | 'umbra' | 'cardType' | 'modifier' | 'class' | 'count'

const PERSONA_ENGRAVING_SLOTS: readonly PersonaEngravingSlot[] = ['slot1', 'slot2']

function getBadgeClassName(tone: BadgeTone) {
  switch (tone) {
    case 'lux':
      return 'border-[#facc15]/35 bg-[#713f12]/65 text-[#fef3c7]'
    case 'umbra':
      return 'border-[#a78bfa]/35 bg-[#2e1065]/65 text-[#ddd6fe]'
    case 'cardType':
      return 'border-[#1d4ed8]/35 bg-[#1e3a8a]/70 text-[#bfdbfe]'
    case 'modifier':
      return 'border-[#8b5cf6]/35 bg-[#2e1065]/65 text-[#ddd6fe]'
    case 'class':
      return 'border-[#0284c7]/35 bg-[#082f49]/65 text-[#7dd3fc]'
    case 'count':
      return 'border-[#4c1d95]/40 bg-[#2e1065]/70 text-[#ddd6fe]'
    default:
      return 'border-[#334155]/70 bg-[#1e293b]/70 text-[#cbd5e1]'
  }
}

function getEidolonBadgeTone(eidolon: string): BadgeTone {
  return eidolon.toLowerCase() === 'umbra' ? 'umbra' : 'lux'
}

function SmallBadge({ children, tone }: { children: ReactNode; tone: BadgeTone }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[9px] font-black uppercase leading-none ${getBadgeClassName(
        tone,
      )}`}
    >
      {children}
    </span>
  )
}

function isSameEngraving(
  left: DeckBuilderPersonaEngraving | null,
  right: DeckBuilderPersonaEngraving,
) {
  return left?.engraving_id === right.engraving_id
}

function getSlotLabel(slot: PersonaEngravingSlot, slot1Label: string, slot2Label: string) {
  return slot === 'slot1' ? slot1Label : slot2Label
}

function getSlotValue(
  selection: DeckBuilderPersonaEngravingSelection,
  slot: PersonaEngravingSlot,
) {
  return slot === 'slot1' ? selection.slot1 : selection.slot2
}


export function PersonaEngravingSection({
  card,
  selectedVariant,
  combatantClass,
  selectedPersonaEngravings,
  onChange,
}: PersonaEngravingSectionProps) {
  const { t } = useTranslation()
  const [searchText, setSearchText] = useState('')
  const [matchCurrentCard, setMatchCurrentCard] = useState(true)

  const currentCardType = useMemo(
    () => resolvePersonaEngravingCardType(card, selectedVariant),
    [card, selectedVariant],
  )

  const compatibleEngravings = useMemo(
    () =>
      filterPersonaEngravings({
        cardType: currentCardType,
        combatantClass,
        searchText,
        matchCurrentCard,
      }),
    [combatantClass, currentCardType, matchCurrentCard, searchText],
  )

  function handleSelectEngraving(
    slot: PersonaEngravingSlot,
    item: DeckBuilderPersonaEngraving,
  ) {
    const nextSelection: DeckBuilderPersonaEngravingSelection = {
      slot1: selectedPersonaEngravings.slot1,
      slot2: selectedPersonaEngravings.slot2,
    }

    if (isSameEngraving(nextSelection[slot], item)) {
      nextSelection[slot] = null
    } else {
      nextSelection[slot] = item
    }

    onChange(nextSelection)
  }

  function handleClearSlot(slot: PersonaEngravingSlot) {
    onChange({
      ...selectedPersonaEngravings,
      [slot]: null,
    })
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3">
      <div className="rounded-xl border border-[#282838] bg-[#12121a] p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#60a5fa]">
          {t('deckBuilder.variantModal.engravingSectionLabel')}
        </p>
        <h3 className="mt-1 text-lg font-black text-white">
          {t('deckBuilder.variantModal.personaCard')}
        </h3>
        <p className="mt-2 text-xs font-semibold leading-relaxed text-[#a6adbb]">
          {t('deckBuilder.variantModal.engravingDescription')}
        </p>
      </div>

      <div className="rounded-xl border border-[#303044] bg-[#12121c] p-3">
        <div className="flex items-center gap-3 rounded-lg border border-[#303044] bg-[#0f0f18] px-3 py-2">
          <Search size={15} className="shrink-0 text-[#8b8b9a]" />
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder={t('deckBuilder.cardSelection.searchPlaceholder')}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6b7280]"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[#b7b7c8]">
            <input
              type="checkbox"
              checked={matchCurrentCard}
              onChange={event => setMatchCurrentCard(event.target.checked)}
              className="h-4 w-4 accent-[#60a5fa]"
            />
            {t('deckBuilder.variantModal.matchCurrentCard')}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {currentCardType && <SmallBadge tone="cardType">{currentCardType}</SmallBadge>}
            {combatantClass && <SmallBadge tone="class">{combatantClass}</SmallBadge>}
            <SmallBadge tone="count">
              {t('deckBuilder.variantModal.compatibleOptions', {
                count: compatibleEngravings.length,
              })}
            </SmallBadge>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-2">
        {PERSONA_ENGRAVING_SLOTS.map(slot => {
          const selectedItem = getSlotValue(selectedPersonaEngravings, slot)
          const slotLabel = getSlotLabel(
            slot,
            t('deckBuilder.variantModal.engravingSlot1'),
            t('deckBuilder.variantModal.engravingSlot2'),
          )

          return (
            <section
              key={slot}
              className="flex min-h-0 flex-col rounded-xl border border-[#303044] bg-[#12121c] p-3"
            >
              <div className="flex shrink-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xs font-black uppercase tracking-wide text-white">
                    {slotLabel}
                  </h3>
                  <p className="mt-1 truncate text-[10px] font-semibold text-[#8b8b9a]">
                    {selectedItem
                      ? `${selectedItem.eidolon} • ${selectedItem.description}`
                      : t('deckBuilder.variantModal.noEngravingSelected')}
                  </p>
                </div>

                {selectedItem && (
                  <button
                    type="button"
                    onClick={() => handleClearSlot(slot)}
                    className="shrink-0 text-[10px] font-black uppercase text-[#fca5a5] hover:text-[#fecaca]"
                  >
                    {t('deckBuilder.clear')}
                  </button>
                )}
              </div>

              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {compatibleEngravings.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#303044] p-4 text-center text-xs font-semibold text-[#8b8b9a]">
                    {t('deckBuilder.variantModal.noOptions')}
                  </p>
                ) : (
                  compatibleEngravings.map(item => {
                    const isSelected = isSameEngraving(selectedItem, item)

                    return (
                      <button
                        key={`${slot}-${item.engraving_id}`}
                        type="button"
                        onClick={() => handleSelectEngraving(slot, item)}
                        className={`relative rounded-lg border p-3 text-left transition ${
                          isSelected
                            ? 'border-[#60a5fa] bg-[#162033] text-white shadow-[0_0_0_1px_rgba(96,165,250,0.2)]'
                            : 'border-[#303044] bg-[#11111a] text-[#e5e7eb] hover:border-[#60a5fa]/45 hover:bg-[#171723]'
                        }`}
                      >
                        <div className="flex flex-wrap items-center gap-1.5 pr-5">
                          <SmallBadge tone={getEidolonBadgeTone(item.eidolon)}>
                            {item.eidolon}
                          </SmallBadge>

                          <SmallBadge tone="cardType">{item.card_type}</SmallBadge>

                          {(item.modifiers ?? []).map(modifier => (
                            <SmallBadge key={modifier} tone="modifier">
                              {modifier}
                            </SmallBadge>
                          ))}
                        </div>

                        {(item.allowed_classes ?? []).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.allowed_classes.map(allowedClass => (
                              <SmallBadge key={allowedClass} tone="class">
                                {allowedClass}
                              </SmallBadge>
                            ))}
                          </div>
                        )}

                        <p className="mt-2 text-xs font-bold leading-snug text-white">
                          {item.description}
                        </p>

                        {isSelected && (
                          <span className="absolute right-3 top-3 text-xs font-black text-[#60a5fa]">
                            ✓
                          </span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}
