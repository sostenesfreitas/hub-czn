import { useEffect, useMemo, useState } from 'react'
import { Check, Search, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getDivineGodIconUrl } from '@/lib/deck-builder-assets'
import {
  formatCardDisplayDescription,
  mergeCardDisplayTags,
} from '../deck-builder-card-display.utils'
import {
  createEmptyPersonaEngravingSelection,
  isPersonaDeckBuilderCard,
} from '../deck-builder-persona-engraving.utils'
import type {
  DeckBuilderCommonEpiphany,
  DeckBuilderDivineEpiphany,
  DeckBuilderDivineGod,
  DeckBuilderEpiphanyVariant,
  DeckBuilderPersonaEngraving,
  DeckBuilderPersonaEngravingSelection,
  DeckCardEpiphanySettings,
  VariantModalTarget,
} from '../deck-builder.types'
import {
  applyPersonaEngravingImageOverride,
  canUseDeckBuilderEpiphanies,
  DECK_BUILDER_DIVINE_GODS,
  getDisplayTypes,
  getVariants,
} from '../deck-builder.utils'
import commonEpiphaniesData from '../data/deck-builder-common-epiphanies.json'
import divineEpiphaniesData from '../data/deck-builder-divine-epiphanies.json'
import { CardImage } from './CardImage'
import { PersonaEngravingSection } from './PersonaEngravingSection'
import { TypeBadge } from './TypeBadge'

const DIVINE_EPIPHANIES = divineEpiphaniesData as DeckBuilderDivineEpiphany[]
const COMMON_EPIPHANIES = commonEpiphaniesData as DeckBuilderCommonEpiphany[]

type EpiphanyItem = DeckBuilderDivineEpiphany | DeckBuilderCommonEpiphany
export type VariantModalInitialSection = 'description' | 'epiphany'
type ModalSection = VariantModalInitialSection | 'engraving'

function normalizeComparable(value: string | number | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9+]+/g, '')
}

function normalizeText(value: string | number | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

function normalizeLevel(value: string | number | null | undefined) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
}

function getCardLevel(cost: number) {
  if (cost >= 4) {
    return '4+'
  }

  return String(Math.max(0, cost))
}

function getEpiphanyLevels(item: EpiphanyItem) {
  return item.levels ?? []
}

function getEpiphanyCardTypes(item: EpiphanyItem) {
  return item.card_types ?? []
}

function getEpiphanyAllowedClasses(item: EpiphanyItem) {
  return item.allowed_classes ?? []
}

function getEpiphanyTags(item: EpiphanyItem) {
  return item.tags ?? []
}

function getVisibleEpiphanyTags(item: EpiphanyItem) {
  return getEpiphanyTags(item).filter(
    (tag) => normalizeComparable(tag) !== 'sortie',
  )
}

function getVariantCardType(
  selectedVariant: DeckBuilderEpiphanyVariant | null,
) {
  return (
    (selectedVariant as { card_type?: string | null } | null)?.card_type ?? null
  )
}

function getVariantTags(selectedVariant: DeckBuilderEpiphanyVariant | null) {
  return (selectedVariant as { tags?: string[] | null } | null)?.tags ?? []
}

function hasCurrentCardConstraint(item: EpiphanyItem) {
  return (
    getEpiphanyCardTypes(item).length > 0 ||
    getEpiphanyLevels(item).length > 0 ||
    getEpiphanyAllowedClasses(item).length > 0
  )
}

function matchesSearch(item: EpiphanyItem, searchText: string) {
  const normalizedSearch = normalizeText(searchText)

  if (!normalizedSearch) {
    return true
  }

  const searchableText = [
    item.description,
    item.raw_text,
    item.rarity,
    ...getEpiphanyCardTypes(item),
    ...getEpiphanyLevels(item),
    ...getEpiphanyAllowedClasses(item),
    ...getEpiphanyTags(item),
  ]
    .map(normalizeText)
    .join(' ')

  return searchableText.includes(normalizedSearch)
}

function getCurrentCardTypeTokens(
  target: VariantModalTarget,
  selectedVariant: DeckBuilderEpiphanyVariant | null,
) {
  const card = target.type === 'deck' ? target.card : target.item.card

  const rawTypes = [
    ...getDisplayTypes(card, selectedVariant),
    ...(getVariantCardType(selectedVariant)
      ? [getVariantCardType(selectedVariant) as string]
      : []),
    ...getVariantTags(selectedVariant),
  ]

  const tokens = new Set<string>()

  rawTypes.forEach((type) => {
    const normalized = normalizeComparable(type)

    if (!normalized) {
      return
    }

    tokens.add(normalized)

    if (
      normalized === 'dmg' ||
      normalized === 'damage' ||
      normalized === 'attack'
    ) {
      tokens.add('attack')
      tokens.add('dmg')
      return
    }

    if (
      normalized === 'skill' ||
      normalized === 'draw' ||
      normalized === 'get' ||
      normalized === 'buff' ||
      normalized === 'cost' ||
      normalized === 'discard' ||
      normalized === 'exhaust'
    ) {
      tokens.add('skill')
      return
    }

    if (normalized === 'upgrade') {
      tokens.add('upgrade')
    }
  })

  return tokens
}

function matchesCardTypes({
  item,
  target,
  selectedVariant,
}: {
  item: EpiphanyItem
  target: VariantModalTarget
  selectedVariant: DeckBuilderEpiphanyVariant | null
}) {
  const requiredTypes = getEpiphanyCardTypes(item)

  if (requiredTypes.length === 0) {
    return true
  }

  const currentTypeTokens = getCurrentCardTypeTokens(target, selectedVariant)

  return requiredTypes.some((requiredType) => {
    const normalizedRequiredType = normalizeComparable(requiredType)

    if (!normalizedRequiredType) {
      return false
    }

    if (currentTypeTokens.has(normalizedRequiredType)) {
      return true
    }

    if (normalizedRequiredType === 'attack' && currentTypeTokens.has('dmg')) {
      return true
    }

    return false
  })
}

function matchesLevels({
  item,
  currentCost,
}: {
  item: EpiphanyItem
  currentCost: number
}) {
  const levels = getEpiphanyLevels(item)

  if (levels.length === 0) {
    return true
  }

  const currentLevel = normalizeLevel(getCardLevel(currentCost))
  const currentCostText = normalizeLevel(currentCost)

  return levels.some((level) => {
    const normalizedLevel = normalizeLevel(level)

    if (!normalizedLevel) {
      return false
    }

    if (normalizedLevel === 'x') {
      return true
    }

    if (
      normalizedLevel === currentLevel ||
      normalizedLevel === currentCostText
    ) {
      return true
    }

    if (normalizedLevel === '4+' && currentCost >= 4) {
      return true
    }

    return false
  })
}

function matchesAllowedClasses({
  item,
  combatantClass,
}: {
  item: EpiphanyItem
  combatantClass: string | null | undefined
}) {
  const allowedClasses = getEpiphanyAllowedClasses(item)

  if (allowedClasses.length === 0) {
    return true
  }

  if (!combatantClass) {
    return true
  }

  const normalizedCombatantClass = normalizeComparable(combatantClass)

  return allowedClasses.some(
    (allowedClass) =>
      normalizeComparable(allowedClass) === normalizedCombatantClass,
  )
}

function matchesCurrentCard({
  item,
  target,
  selectedVariant,
  combatantClass,
  currentCost,
}: {
  item: EpiphanyItem
  target: VariantModalTarget
  selectedVariant: DeckBuilderEpiphanyVariant | null
  combatantClass: string | null | undefined
  currentCost: number
}) {
  if (!hasCurrentCardConstraint(item)) {
    return false
  }

  if (!matchesCardTypes({ item, target, selectedVariant })) {
    return false
  }

  if (!matchesLevels({ item, currentCost })) {
    return false
  }

  if (!matchesAllowedClasses({ item, combatantClass })) {
    return false
  }

  return true
}

function matchesDivineGod({
  item,
  selectedDivineGod,
  matchSelectedGod,
}: {
  item: DeckBuilderDivineEpiphany
  selectedDivineGod: DeckBuilderDivineGod | null
  matchSelectedGod: boolean
}) {
  if (!matchSelectedGod || !selectedDivineGod) {
    return true
  }

  return (
    normalizeComparable(item.god) === normalizeComparable(selectedDivineGod.id)
  )
}

function filterCompatibleDivineEpiphanies({
  target,
  selectedVariant,
  selectedDivineGod,
  combatantClass,
  currentCost,
  searchText,
  matchCurrentCard,
  matchSelectedGod,
}: {
  target: VariantModalTarget
  selectedVariant: DeckBuilderEpiphanyVariant | null
  selectedDivineGod: DeckBuilderDivineGod | null
  combatantClass: string | null | undefined
  currentCost: number
  searchText: string
  matchCurrentCard: boolean
  matchSelectedGod: boolean
}) {
  return DIVINE_EPIPHANIES.filter((item) => {
    if (!matchesSearch(item, searchText)) {
      return false
    }

    if (!matchesDivineGod({ item, selectedDivineGod, matchSelectedGod })) {
      return false
    }

    if (
      matchCurrentCard &&
      !matchesCurrentCard({
        item,
        target,
        selectedVariant,
        combatantClass,
        currentCost,
      })
    ) {
      return false
    }

    return true
  })
}

function filterCompatibleCommonEpiphanies({
  target,
  selectedVariant,
  combatantClass,
  currentCost,
  searchText,
  matchCurrentCard,
}: {
  target: VariantModalTarget
  selectedVariant: DeckBuilderEpiphanyVariant | null
  combatantClass: string | null | undefined
  currentCost: number
  searchText: string
  matchCurrentCard: boolean
}) {
  return COMMON_EPIPHANIES.filter((item) => {
    if (!matchesSearch(item, searchText)) {
      return false
    }

    if (
      matchCurrentCard &&
      !matchesCurrentCard({
        item,
        target,
        selectedVariant,
        combatantClass,
        currentCost,
      })
    ) {
      return false
    }

    return true
  })
}

function MetadataPill({
  children,
  variant = 'default',
}: {
  children: string
  variant?: 'default' | 'level' | 'danger'
}) {
  const className = {
    default: 'bg-[#082f49]/70 text-[#7dd3fc]',
    level: 'bg-[#1f1b2e] text-[#c4b5fd]',
    danger: 'bg-[#451a1a]/70 text-[#fca5a5]',
  }[variant]

  return (
    <span
      className={[
        'rounded px-1.5 py-0.5 text-[8px] font-black uppercase leading-none',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}

function EpiphanyOptionButton({
  item,
  isSelected,
  onClick,
  variant,
}: {
  item: EpiphanyItem
  isSelected: boolean
  onClick: () => void
  variant: 'divine' | 'spark'
}) {
  const selectedClassName =
    variant === 'divine'
      ? 'border-[#c084fc] bg-[#2e1065]/45 shadow-[0_0_0_1px_rgba(192,132,252,0.2)]'
      : 'border-[#38bdf8] bg-[#082f49]/60 shadow-[0_0_0_1px_rgba(56,189,248,0.2)]'

  const cardTypes = getEpiphanyCardTypes(item)
  const levels = getEpiphanyLevels(item)
  const allowedClasses = getEpiphanyAllowedClasses(item)
  const tags = getVisibleEpiphanyTags(item)

  return (
    <button
      type="button"
      onClick={onClick}
      title={item.raw_text || item.description}
      className={[
        'group h-fit rounded-lg border p-2.5 text-left transition-colors',
        isSelected
          ? selectedClassName
          : 'border-[#303044] bg-[#101018] hover:border-[#60a5fa] hover:bg-[#151522]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            <p className="text-[10px] font-black uppercase tracking-wide text-[#facc15]">
              {item.rarity}
            </p>

            {cardTypes.slice(0, 2).map((type) => (
              <TypeBadge key={type} type={type} />
            ))}

            {tags.slice(0, 2).map((tag) => (
              <MetadataPill key={tag} variant="danger">
                {tag}
              </MetadataPill>
            ))}
          </div>

          <p className="mt-2 line-clamp-2 text-[11px] font-bold leading-snug text-white">
            {item.description}
          </p>
        </div>

        {isSelected && (
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#1d4ed8] text-white">
            <Check size={12} />
          </span>
        )}
      </div>

      {(levels.length > 0 || allowedClasses.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {levels.slice(0, 4).map((level) => (
            <MetadataPill key={level} variant="level">
              {`Lv ${level}`}
            </MetadataPill>
          ))}

          {allowedClasses.slice(0, 3).map((className) => (
            <MetadataPill key={className}>{className}</MetadataPill>
          ))}
        </div>
      )}
    </button>
  )
}

function DivineGodButton({
  god,
  isSelected,
  onClick,
}: {
  god: DeckBuilderDivineGod
  isSelected: boolean
  onClick: () => void
}) {
  const iconUrl = getDivineGodIconUrl(god)

  return (
    <button
      type="button"
      onClick={onClick}
      title={god.displayName}
      className={[
        'grid h-7 w-7 place-items-center rounded-lg border bg-[#101018] transition',
        isSelected
          ? 'border-[#60a5fa] bg-[#082f49]/70 shadow-[0_0_0_1px_rgba(96,165,250,0.35)]'
          : 'border-[#303044] hover:border-[#c084fc]',
      ].join(' ')}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={god.displayName}
          className="h-[18px] w-[18px] object-contain"
          draggable={false}
        />
      ) : (
        <span className="text-[10px] font-black text-white">
          {god.displayName.slice(0, 2).toUpperCase()}
        </span>
      )}
    </button>
  )
}

function VariantButton({
  variant,
  isSelected,
  onClick,
}: {
  variant: DeckBuilderEpiphanyVariant
  isSelected: boolean
  onClick: () => void
}) {
  const formattedDescription = formatCardDisplayDescription(variant.description)
  const visibleTags = formattedDescription.tags.slice(0, 4)
  const hiddenTagsCount = Math.max(
    0,
    formattedDescription.tags.length - visibleTags.length,
  )

  return (
    <button
      key={variant.variant_id}
      type="button"
      onClick={onClick}
      title={variant.description}
      className={[
        'min-w-0 rounded-lg border p-2.5 text-left transition',
        isSelected
          ? 'border-[#38bdf8] bg-[#082f49]/65'
          : 'border-[#333348] bg-[#101018] hover:border-[#60a5fa]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-1 text-xs font-black text-white">
          {variant.name}
        </p>

        <span className="grid h-6 min-w-6 shrink-0 place-items-center rounded bg-[#0f172a] px-1.5 text-xs font-black text-[#93c5fd]">
          {variant.cost}
        </span>
      </div>

      {visibleTags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <TypeBadge key={tag} type={tag} />
          ))}

          {hiddenTagsCount > 0 && (
            <span className="rounded bg-[#1f1b2e] px-1.5 py-0.5 text-[8px] font-black text-[#c4b5fd]">
              +{hiddenTagsCount}
            </span>
          )}
        </div>
      )}

      <p className="mt-1.5 line-clamp-2 text-[10px] font-semibold leading-snug text-[#dbeafe]">
        {formattedDescription.text}
      </p>
    </button>
  )
}

function FilterCheckbox({
  checked,
  label,
  onChange,
}: {
  checked: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-[#a1a1aa]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#f97316]"
      />

      {label}
    </label>
  )
}

function getInitialPersonaEngravings(target: VariantModalTarget) {
  return target.type === 'deck'
    ? (target.selectedPersonaEngravings ??
        createEmptyPersonaEngravingSelection())
    : createEmptyPersonaEngravingSelection()
}

type PersonaEngravingSlotKey = keyof DeckBuilderPersonaEngravingSelection

function getSelectedPersonaEngravingSummary(
  selection: DeckBuilderPersonaEngravingSelection,
) {
  const selectedEidolons = [selection.slot1, selection.slot2]
    .filter((item): item is DeckBuilderPersonaEngraving => Boolean(item))
    .map((item) => item.eidolon)

  return selectedEidolons.length > 0 ? selectedEidolons.join(' + ') : null
}

function getPersonaEngravingToneClasses(
  engraving: DeckBuilderPersonaEngraving | null,
) {
  if (!engraving) {
    return {
      card: 'border-[#303044] bg-[#11111a]',
      label: 'text-[#8b8b9a]',
      badge: 'border-[#334155]/70 bg-[#1e293b]/70 text-[#cbd5e1]',
      text: 'text-[#a1a1aa]',
    }
  }

  if (engraving.eidolon.toLowerCase() === 'umbra') {
    return {
      card: 'border-[#a78bfa]/25 bg-[#2e1065]/30',
      label: 'text-[#c4b5fd]',
      badge: 'border-[#a78bfa]/35 bg-[#4c1d95]/80 text-[#ede9fe]',
      text: 'text-[#ede9fe]',
    }
  }

  return {
    card: 'border-[#facc15]/25 bg-[#422006]/25',
    label: 'text-[#facc15]',
    badge: 'border-[#facc15]/35 bg-[#713f12]/80 text-[#fef3c7]',
    text: 'text-[#fef3c7]',
  }
}

function getPersonaEngravingSlotValue(
  selection: DeckBuilderPersonaEngravingSelection,
  slot: PersonaEngravingSlotKey,
) {
  return slot === 'slot1' ? selection.slot1 : selection.slot2
}

function SelectedPersonaEngravingSlotCard({
  label,
  engraving,
  emptyLabel,
}: {
  label: string
  engraving: DeckBuilderPersonaEngraving | null
  emptyLabel: string
}) {
  const toneClasses = getPersonaEngravingToneClasses(engraving)

  return (
    <div className={`rounded-md border p-2 ${toneClasses.card}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-[9px] font-black uppercase ${toneClasses.label}`}>
          {label}
        </p>

        {engraving && (
          <span
            className={`rounded border px-1.5 py-0.5 text-[8px] font-black uppercase leading-none ${toneClasses.badge}`}
          >
            {engraving.eidolon}
          </span>
        )}
      </div>

      <p className={`mt-1 text-[10px] font-semibold leading-relaxed ${toneClasses.text}`}>
        {engraving?.description ?? emptyLabel}
      </p>
    </div>
  )
}

function SelectedEpiphanySummaryRow({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'god' | 'divine' | 'spark'
}) {
  const toneClassName = {
    god: 'border-[#0ea5e9]/30 bg-[#082f49]/35 text-[#dbeafe]',
    divine: 'border-[#c084fc]/30 bg-[#2e1065]/35 text-[#f3e8ff]',
    spark: 'border-[#facc15]/30 bg-[#422006]/30 text-[#fef3c7]',
  }[tone]

  return (
    <div className={`rounded-md border px-2 py-1 ${toneClassName}`}>
      <p className="text-[8px] font-black uppercase tracking-wide opacity-80">
        {label}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[9px] font-bold leading-snug">
        {value}
      </p>
    </div>
  )
}

export function VariantSettingsModal({
  target,
  combatantClass,
  initialSection,
  onClose,
  onApplySettings,
  onClearSettings,
}: {
  target: VariantModalTarget
  combatantClass?: string | null
  initialSection?: VariantModalInitialSection
  onClose: () => void
  onApplySettings: (settings: DeckCardEpiphanySettings) => void
  onClearSettings?: () => void
}) {
  const { t } = useTranslation()

  const card = target.type === 'deck' ? target.card : target.item.card

  const variants =
    target.type === 'deck' ? target.variants : getVariants(target.item)

  const baseDescription =
    target.type === 'deck' ? target.description : target.item.description

  const isPersonaCard = isPersonaDeckBuilderCard(card)
  const canUseEpiphanies = canUseDeckBuilderEpiphanies(card)
  const canShowEpiphanySection =
    !isPersonaCard && (variants.length > 0 || canUseEpiphanies)
  const canShowEngravingSection = isPersonaCard
  const defaultInitialSection: ModalSection =
    target.type === 'deck'
      ? 'description'
      : canShowEngravingSection
        ? 'engraving'
        : 'epiphany'
  const normalizedInitialSection: ModalSection =
    initialSection === 'epiphany' && canShowEngravingSection
      ? 'engraving'
      : (initialSection ?? defaultInitialSection)

  const [activeSection, setActiveSection] = useState<ModalSection>(
    normalizedInitialSection,
  )

  const [searchText, setSearchText] = useState('')
  const [matchCurrentCard, setMatchCurrentCard] = useState(true)
  const [matchSelectedGod, setMatchSelectedGod] = useState(true)

  const [selectedVariant, setSelectedVariant] =
    useState<DeckBuilderEpiphanyVariant | null>(
      target.type === 'deck' ? (target.selectedVariant ?? null) : null,
    )

  const [selectedDivineGod, setSelectedDivineGod] =
    useState<DeckBuilderDivineGod | null>(
      target.type === 'deck' && !isPersonaCard
        ? (target.selectedDivineGod ?? null)
        : null,
    )

  const [selectedDivineEpiphany, setSelectedDivineEpiphany] =
    useState<DeckBuilderDivineEpiphany | null>(
      target.type === 'deck' && !isPersonaCard
        ? (target.selectedDivineEpiphany ?? null)
        : null,
    )

  const [selectedCommonEpiphany, setSelectedCommonEpiphany] =
    useState<DeckBuilderCommonEpiphany | null>(
      target.type === 'deck' && !isPersonaCard
        ? (target.selectedCommonEpiphany ?? null)
        : null,
    )

  const [selectedPersonaEngravings, setSelectedPersonaEngravings] =
    useState<DeckBuilderPersonaEngravingSelection>(() =>
      getInitialPersonaEngravings(target),
    )

  const previewCard = useMemo(
    () =>
      isPersonaCard
        ? applyPersonaEngravingImageOverride(card, selectedPersonaEngravings)
        : card,
    [card, isPersonaCard, selectedPersonaEngravings],
  )

  const currentCost = selectedVariant?.cost ?? card.cost
  const currentDescription = selectedVariant?.description ?? baseDescription
  const formattedCurrentDescription = useMemo(
    () => formatCardDisplayDescription(currentDescription),
    [currentDescription],
  )
  const currentTypes = selectedVariant
    ? getDisplayTypes(card, selectedVariant)
    : card.effect_types
  const currentDisplayTags = mergeCardDisplayTags(
    currentTypes,
    formattedCurrentDescription.tags,
  )

  useEffect(() => {
    if (activeSection === 'epiphany' && !canShowEpiphanySection) {
      setActiveSection(canShowEngravingSection ? 'engraving' : 'description')
      return
    }

    if (activeSection === 'engraving' && !canShowEngravingSection) {
      setActiveSection(canShowEpiphanySection ? 'epiphany' : 'description')
    }
  }, [activeSection, canShowEngravingSection, canShowEpiphanySection])

  const divineEpiphanies = useMemo(() => {
    if (!canUseEpiphanies || isPersonaCard) {
      return []
    }

    return filterCompatibleDivineEpiphanies({
      target,
      selectedVariant,
      selectedDivineGod,
      combatantClass,
      currentCost,
      searchText,
      matchCurrentCard,
      matchSelectedGod,
    })
  }, [
    canUseEpiphanies,
    combatantClass,
    currentCost,
    isPersonaCard,
    matchCurrentCard,
    matchSelectedGod,
    searchText,
    selectedDivineGod,
    selectedVariant,
    target,
  ])

  const commonEpiphanies = useMemo(() => {
    if (!canUseEpiphanies || isPersonaCard) {
      return []
    }

    return filterCompatibleCommonEpiphanies({
      target,
      selectedVariant,
      combatantClass,
      currentCost,
      searchText,
      matchCurrentCard,
    })
  }, [
    canUseEpiphanies,
    combatantClass,
    currentCost,
    isPersonaCard,
    matchCurrentCard,
    searchText,
    selectedVariant,
    target,
  ])

  useEffect(() => {
    if (
      selectedDivineEpiphany &&
      !divineEpiphanies.some((item) => item.id === selectedDivineEpiphany.id)
    ) {
      setSelectedDivineEpiphany(null)
    }
  }, [divineEpiphanies, selectedDivineEpiphany])

  useEffect(() => {
    if (
      selectedCommonEpiphany &&
      !commonEpiphanies.some((item) => item.id === selectedCommonEpiphany.id)
    ) {
      setSelectedCommonEpiphany(null)
    }
  }, [commonEpiphanies, selectedCommonEpiphany])

  function handleSelectGod(god: DeckBuilderDivineGod) {
    const nextGod = selectedDivineGod?.id === god.id ? null : god

    setSelectedDivineGod(nextGod)

    if (!nextGod) {
      setSelectedDivineEpiphany(null)
      return
    }

    if (selectedDivineEpiphany?.god !== nextGod.id) {
      setSelectedDivineEpiphany(null)
    }
  }

  function handleClearLocalSettings() {
    setSelectedVariant(null)
    setSelectedDivineGod(null)
    setSelectedDivineEpiphany(null)
    setSelectedCommonEpiphany(null)
    setSelectedPersonaEngravings(createEmptyPersonaEngravingSelection())

    if (onClearSettings) {
      onClearSettings()
    }
  }

  function handleApply() {
    onApplySettings({
      selectedVariant,
      selectedDivineGod: isPersonaCard ? null : selectedDivineGod,
      selectedDivineEpiphany: isPersonaCard ? null : selectedDivineEpiphany,
      selectedCommonEpiphany: isPersonaCard ? null : selectedCommonEpiphany,
      selectedPersonaEngravings: isPersonaCard
        ? selectedPersonaEngravings
        : createEmptyPersonaEngravingSelection(),
    })

    onClose()
  }

  const displayTitle = selectedVariant?.name ?? card.name
  const secondarySection: ModalSection = canShowEngravingSection
    ? 'engraving'
    : 'epiphany'
  const hasSecondarySection = canShowEpiphanySection || canShowEngravingSection
  const isSettingsSection =
    activeSection === 'epiphany' || activeSection === 'engraving'
  const footerGodText =
    selectedDivineGod?.displayName ?? t('deckBuilder.variantModal.noneGod')
  const footerSparkText =
    selectedCommonEpiphany?.description ??
    t('deckBuilder.variantModal.noneSpark')
  const footerEngravingSlot1 =
    selectedPersonaEngravings.slot1?.description ??
    t('deckBuilder.variantModal.noEngravingSelected')
  const footerEngravingSlot2 =
    selectedPersonaEngravings.slot2?.description ??
    t('deckBuilder.variantModal.noEngravingSelected')
  const hasSelectedEpiphanySettings = Boolean(
    selectedDivineGod || selectedDivineEpiphany || selectedCommonEpiphany,
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="flex h-[86vh] max-h-[860px] min-h-[680px] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-[#303044] bg-[#15151f] shadow-2xl">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#282838] p-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <Sparkles size={17} className="shrink-0 text-[#7dd3fc]" />

                <h2 className="truncate text-base font-black text-white">
                  {target.type === 'deck'
                    ? displayTitle
                    : canShowEngravingSection
                      ? t('deckBuilder.variantModal.engravingSettings')
                      : t('deckBuilder.variantModal.epiphanySettings')}
                </h2>
              </div>

              {target.type === 'deck' && (
                <div className="inline-flex rounded-full border border-[#282838] bg-[#101018] p-1">
                  <button
                    type="button"
                    onClick={() => setActiveSection('description')}
                    className={[
                      'rounded-full px-4 py-1.5 text-[11px] font-bold transition',
                      activeSection === 'description'
                        ? 'bg-[#312e81] text-white shadow'
                        : 'text-[#a1a1aa] hover:text-white',
                    ].join(' ')}
                  >
                    {t('deckBuilder.variantModal.descriptionTab')}
                  </button>

                  {hasSecondarySection && (
                    <button
                      type="button"
                      onClick={() => setActiveSection(secondarySection)}
                      className={[
                        'rounded-full px-4 py-1.5 text-[11px] font-bold transition',
                        activeSection === secondarySection
                          ? 'bg-[#075985] text-white shadow'
                          : 'text-[#a1a1aa] hover:text-white',
                      ].join(' ')}
                    >
                      {canShowEngravingSection
                        ? t('deckBuilder.variantModal.engravingTab')
                        : t('deckBuilder.variantModal.epiphanyTab')}
                    </button>
                  )}
                </div>
              )}
            </div>

            <p className="mt-1 text-xs text-[#a1a1aa]">
              {target.type === 'deck' ? (
                canShowEngravingSection ? (
                  t('deckBuilder.variantModal.engravingHeaderDescription')
                ) : (
                  t('deckBuilder.variantModal.headerDescription')
                )
              ) : (
                <>
                  {t('deckBuilder.variantModal.configurePrefix')}{' '}
                  <span className="font-bold text-white">{card.name}</span>.
                </>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#a1a1aa] transition hover:bg-[#282838] hover:text-white"
            aria-label={t('deckBuilder.close')}
          >
            <X size={18} />
          </button>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-[296px_minmax(0,1fr)] gap-4 overflow-hidden p-4">
          <aside className="min-h-0 overflow-hidden rounded-xl border border-[#303044] bg-[#12121a] p-2.5">
            <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#8b8b9a]">
              {t('deckBuilder.variantModal.currentCard')}
            </p>

            <div className="rounded-xl border border-[#303044] bg-[#101018] p-2.5">
              <div
                className={[
                  'relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-lg border border-[#333348] bg-[#0f0f18]',
                  activeSection === 'epiphany' && hasSelectedEpiphanySettings
                    ? 'max-w-[112px]'
                    : activeSection === 'epiphany'
                      ? 'max-w-[150px]'
                      : 'max-w-[190px]',
                ].join(' ')}
              >
                <CardImage card={previewCard} className="h-full w-full" />
              </div>

              <div className="mt-2.5 flex items-start gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#1e3a8a] text-sm font-black text-[#bfdbfe]">
                  {currentCost}
                </span>

                <div className="min-w-0">
                  <h3 className="truncate text-sm font-black text-white">
                    {displayTitle}
                  </h3>
                  <p className="text-[10px] font-semibold text-[#a1a1aa]">
                    Spark +{card.spark_count}
                  </p>
                </div>
              </div>

              {currentDescription && (
                <div className="mt-2.5 rounded-lg border border-[#0ea5e9]/35 bg-[#082f49]/30 p-2">
                  {currentDisplayTags.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1">
                      {currentDisplayTags.slice(0, 4).map((type) => (
                        <TypeBadge key={type} type={type} />
                      ))}
                    </div>
                  )}

                  <p className="line-clamp-2 text-[10px] font-semibold leading-relaxed text-[#dbeafe]">
                    {formattedCurrentDescription.text}
                  </p>
                </div>
              )}

              {activeSection === 'epiphany' &&
                canShowEpiphanySection &&
                hasSelectedEpiphanySettings && (
                  <div className="mt-2.5 space-y-1.5 rounded-lg border border-[#303044] bg-[#12121a] p-2">
                    {selectedDivineGod && (
                      <SelectedEpiphanySummaryRow
                        label={t('deckBuilder.variantModal.divineGod')}
                        value={selectedDivineGod.displayName}
                        tone="god"
                      />
                    )}

                    {selectedDivineEpiphany && (
                      <SelectedEpiphanySummaryRow
                        label={t('deckBuilder.variantModal.divineEpiphany')}
                        value={selectedDivineEpiphany.description}
                        tone="divine"
                      />
                    )}

                    {selectedCommonEpiphany && (
                      <SelectedEpiphanySummaryRow
                        label={t('deckBuilder.variantModal.sparkEpiphany')}
                        value={selectedCommonEpiphany.description}
                        tone="spark"
                      />
                    )}
                  </div>
                )}

              {isPersonaCard && (
                <div className="mt-3 rounded-lg border border-[#7c3aed]/30 bg-[#1a1630]/55 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#c4b5fd]">
                      {t('deckBuilder.variantModal.engravingSettings')}
                    </p>

                    <span className="rounded border border-[#7c3aed]/40 bg-[#2e1065]/60 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none text-[#ddd6fe]">
                      {getSelectedPersonaEngravingSummary(selectedPersonaEngravings) ??
                        t('deckBuilder.variantModal.noEngravingSelected')}
                    </span>
                  </div>

                  <div className="mt-1.5 space-y-1.5">
                    {(['slot1', 'slot2'] as const).map((slot) => (
                      <SelectedPersonaEngravingSlotCard
                        key={slot}
                        label={t(
                          slot === 'slot1'
                            ? 'deckBuilder.variantModal.engravingSlot1'
                            : 'deckBuilder.variantModal.engravingSlot2',
                        )}
                        engraving={getPersonaEngravingSlotValue(
                          selectedPersonaEngravings,
                          slot,
                        )}
                        emptyLabel={t(
                          'deckBuilder.variantModal.noEngravingSelected',
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {activeSection === 'epiphany' && canShowEpiphanySection && canUseEpiphanies && (
              <section className="mt-2 rounded-xl border border-[#303044] bg-[#12121a] p-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-wide text-[#8b8b9a]">
                      {t('deckBuilder.variantModal.divineGod')}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[10px] font-semibold text-[#8b8b9a]">
                      {selectedDivineGod
                        ? t('deckBuilder.variantModal.filteringByGod', {
                            god: selectedDivineGod.displayName,
                          })
                        : t('deckBuilder.variantModal.noDivineGodSelected')}
                    </p>
                  </div>

                  {selectedDivineGod && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDivineGod(null)
                        setSelectedDivineEpiphany(null)
                      }}
                      className="text-[10px] font-black uppercase text-[#fca5a5] hover:text-[#fecaca]"
                    >
                      {t('deckBuilder.clear')}
                    </button>
                  )}
                </div>

                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {DECK_BUILDER_DIVINE_GODS.map((god) => (
                    <DivineGodButton
                      key={god.id}
                      god={god}
                      isSelected={selectedDivineGod?.id === god.id}
                      onClick={() => handleSelectGod(god)}
                    />
                  ))}
                </div>

                <div className="mt-1.5 space-y-1.5">
                  <FilterCheckbox
                    checked={matchSelectedGod}
                    label={t('deckBuilder.variantModal.matchSelectedGod')}
                    onChange={setMatchSelectedGod}
                  />

                  {combatantClass && (
                    <p className="rounded-lg border border-[#303044] bg-[#101018] px-2 py-1 text-[10px] font-semibold text-[#a1a1aa]">
                      {t('deckBuilder.variantModal.combatantClassLabel')}{' '}
                      <span className="font-black text-white">{combatantClass}</span>
                    </p>
                  )}
                </div>
              </section>
            )}
          </aside>

          <section className="min-h-0 overflow-hidden rounded-xl border border-[#303044] bg-[#15151f] p-4">
            {activeSection === 'description' ? (
              <div className="h-full overflow-y-auto pr-1">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#60a5fa]">
                  {t('deckBuilder.variantModal.card')}
                </p>
                <h3 className="mt-1 text-xl font-black text-white">
                  {displayTitle}
                </h3>

                {currentDisplayTags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {currentDisplayTags.map((type) => (
                      <TypeBadge key={type} type={type} />
                    ))}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-[#303044] bg-[#101018] p-3">
                    <p className="text-[10px] font-black uppercase text-[#8b8b9a]">
                      {t('deckBuilder.variantModal.damageStat')}
                    </p>
                    <p className="mt-1 text-sm font-black text-white">
                      {card.eff_value > 0 ? `${card.eff_value}%` : '-'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#303044] bg-[#101018] p-3">
                    <p className="text-[10px] font-black uppercase text-[#8b8b9a]">
                      {t('deckBuilder.variantModal.hitsStat')}
                    </p>
                    <p className="mt-1 text-sm font-black text-white">
                      {card.hits > 0 ? card.hits : '-'}
                    </p>
                  </div>

                  <div className="rounded-lg border border-[#303044] bg-[#101018] p-3">
                    <p className="text-[10px] font-black uppercase text-[#8b8b9a]">
                      {t('deckBuilder.variantModal.sparkStat')}
                    </p>
                    <p className="mt-1 text-sm font-black text-white">
                      +{card.spark_count}
                    </p>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-[#303044] bg-[#101018] p-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-wider text-[#8b8b9a]">
                    {t('deckBuilder.variantModal.fullDescription')}
                  </p>

                  {currentDescription ? (
                    <p className="whitespace-pre-line text-sm font-semibold leading-relaxed text-[#e5e7eb]">
                      {formattedCurrentDescription.text}
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-[#8b8b9a]">
                      {t('deckBuilder.variantModal.noDescription')}
                    </p>
                  )}
                </div>
              </div>
            ) : activeSection === 'engraving' && canShowEngravingSection ? (
              <PersonaEngravingSection
                card={card}
                selectedVariant={selectedVariant}
                combatantClass={combatantClass}
                selectedPersonaEngravings={selectedPersonaEngravings}
                onChange={setSelectedPersonaEngravings}
              />
            ) : (
              <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden">
                {variants.length > 0 && (
                  <section className="shrink-0 rounded-xl border border-[#303044] bg-[#12121a] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wider text-[#8b8b9a]">
                          {t('deckBuilder.variantModal.variants')}
                        </p>
                        <p className="text-xs font-semibold text-[#a1a1aa]">
                          {t('deckBuilder.variantModal.variantsFound', {
                            count: variants.length,
                          })}
                        </p>
                      </div>

                      {selectedVariant && (
                        <button
                          type="button"
                          onClick={() => setSelectedVariant(null)}
                          className="rounded-lg border border-[#333348] px-3 py-1.5 text-[11px] font-black text-[#d1d5db] hover:border-[#60a5fa] hover:text-[#93c5fd]"
                        >
                          {t('deckBuilder.variantModal.baseVariant')}
                        </button>
                      )}
                    </div>

                    <div className="grid max-h-[214px] grid-cols-2 gap-2 overflow-y-auto pr-1 xl:grid-cols-3">
                      {variants.map((variant) => (
                        <VariantButton
                          key={variant.variant_id}
                          variant={variant}
                          isSelected={
                            selectedVariant?.variant_id === variant.variant_id
                          }
                          onClick={() => setSelectedVariant(variant)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                <section className="shrink-0 rounded-xl border border-[#303044] bg-[#12121a] p-3">
                  <div className="flex items-center gap-3">
                    <div className="relative min-w-0 flex-1">
                      <Search
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#777]"
                      />
                      <input
                        value={searchText}
                        onChange={(event) => setSearchText(event.target.value)}
                        placeholder={t(
                          'deckBuilder.variantModal.searchEpiphanyText',
                        )}
                        className="h-9 w-full rounded-lg border border-[#303044] bg-[#101018] pl-9 pr-3 text-xs font-semibold text-white outline-none placeholder:text-[#777] focus:border-[#60a5fa]"
                      />
                    </div>

                    <div className="shrink-0">
                      <FilterCheckbox
                        checked={matchCurrentCard}
                        label={t('deckBuilder.variantModal.matchCurrentCard')}
                        onChange={setMatchCurrentCard}
                      />
                    </div>
                  </div>
                </section>

                {!canUseEpiphanies ? (
                  <div className="rounded-xl border border-dashed border-[#303044] p-6 text-center">
                    <p className="text-sm font-black text-white">
                      {t('deckBuilder.variantModal.noSparkCard')}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-[#8b8b9a]">
                      {t('deckBuilder.variantModal.noSparkCardHint')}
                    </p>
                  </div>
                ) : (
                  <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-hidden xl:grid-cols-2">
                    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#303044] bg-[#12121a] p-3">
                      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase text-[#c084fc]">
                            {t('deckBuilder.variantModal.divineEpiphany')}
                          </p>
                          <p className="text-[10px] font-black text-[#8b8b9a]">
                            {t('deckBuilder.variantModal.compatibleOptions', {
                              count: divineEpiphanies.length,
                            })}
                          </p>
                        </div>

                        {selectedDivineEpiphany && (
                          <button
                            type="button"
                            onClick={() => setSelectedDivineEpiphany(null)}
                            className="text-[10px] font-black uppercase text-[#fca5a5] hover:text-[#fecaca]"
                          >
                            {t('deckBuilder.clear')}
                          </button>
                        )}
                      </div>

                      <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-1 gap-2 overflow-y-auto pr-1 2xl:grid-cols-2">
                        {divineEpiphanies.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-[#303044] p-4 text-center text-xs font-semibold text-[#8b8b9a] 2xl:col-span-2">
                            {t('deckBuilder.variantModal.noOptions')}
                          </p>
                        ) : (
                          divineEpiphanies.map((item) => (
                            <EpiphanyOptionButton
                              key={item.id}
                              item={item}
                              variant="divine"
                              isSelected={selectedDivineEpiphany?.id === item.id}
                              onClick={() => {
                                setSelectedDivineEpiphany((current) =>
                                  current?.id === item.id ? null : item,
                                )
                              }}
                            />
                          ))
                        )}
                      </div>
                    </section>

                    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[#303044] bg-[#12121a] p-3">
                      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase text-[#facc15]">
                            {t('deckBuilder.variantModal.sparkEpiphany')}
                          </p>
                          <p className="text-[10px] font-black text-[#8b8b9a]">
                            {t('deckBuilder.variantModal.compatibleOptions', {
                              count: commonEpiphanies.length,
                            })}
                          </p>
                        </div>

                        {selectedCommonEpiphany && (
                          <button
                            type="button"
                            onClick={() => setSelectedCommonEpiphany(null)}
                            className="text-[10px] font-black uppercase text-[#fca5a5] hover:text-[#fecaca]"
                          >
                            {t('deckBuilder.clear')}
                          </button>
                        )}
                      </div>

                      <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-1 gap-2 overflow-y-auto pr-1 2xl:grid-cols-2">
                        {commonEpiphanies.length === 0 ? (
                          <p className="rounded-lg border border-dashed border-[#303044] p-4 text-center text-xs font-semibold text-[#8b8b9a] 2xl:col-span-2">
                            {t('deckBuilder.variantModal.noOptions')}
                          </p>
                        ) : (
                          commonEpiphanies.map((item) => (
                            <EpiphanyOptionButton
                              key={item.id}
                              item={item}
                              variant="spark"
                              isSelected={selectedCommonEpiphany?.id === item.id}
                              onClick={() => {
                                setSelectedCommonEpiphany((current) =>
                                  current?.id === item.id ? null : item,
                                )
                              }}
                            />
                          ))
                        )}
                      </div>
                    </section>
                  </div>
                )}
              </div>
            )}
          </section>
        </main>

        <footer className="flex shrink-0 items-center justify-between gap-4 border-t border-[#282838] px-4 py-3">
          {isSettingsSection ? (
            <>
              <p className="min-w-0 truncate text-xs font-semibold text-[#8b8b9a]">
                {activeSection === 'engraving' ? (
                  <>
                    {t('deckBuilder.variantModal.engravingSlot1')}:{' '}
                    <strong className="text-[#dbeafe]">
                      {footerEngravingSlot1}
                    </strong>
                    {' | '}
                    {t('deckBuilder.variantModal.engravingSlot2')}:{' '}
                    <strong className="text-[#dbeafe]">
                      {footerEngravingSlot2}
                    </strong>
                  </>
                ) : (
                  <>
                    {t('deckBuilder.variantModal.footerGod')}:{' '}
                    <strong className="text-[#dbeafe]">{footerGodText}</strong>
                    {' | '}
                    {t('deckBuilder.variantModal.footerSpark')}:{' '}
                    <strong className="text-[#facc15]">
                      {footerSparkText}
                    </strong>
                  </>
                )}
              </p>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearLocalSettings}
                  className="rounded-lg border border-[#3f1d1d] px-4 py-2 text-xs font-black text-[#fca5a5] transition hover:border-[#ef4444] hover:text-[#fecaca]"
                >
                  {t('deckBuilder.clear')}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-[#303044] px-4 py-2 text-xs font-black text-[#d1d5db] transition hover:border-[#60a5fa] hover:text-white"
                >
                  {t('deckBuilder.cancel')}
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-xs font-black text-white shadow-lg shadow-blue-950/30 transition hover:bg-[#1d4ed8]"
                >
                  {t('deckBuilder.apply')}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-[#8b8b9a]">
                {canShowEngravingSection ? (
                  t('deckBuilder.variantModal.engravingTab')
                ) : hasSecondarySection ? (
                  <>
                    {t('deckBuilder.variantModal.footerHintPrefix')}{' '}
                    {t('deckBuilder.variantModal.epiphanyTab')}{' '}
                    {t('deckBuilder.variantModal.footerHintSuffix')}
                  </>
                ) : null}
              </p>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#303044] px-4 py-2 text-xs font-black text-[#d1d5db] transition hover:border-[#60a5fa] hover:text-white"
              >
                {t('deckBuilder.close')}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  )
}
