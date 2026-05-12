import { useEffect, useMemo, useState } from 'react'
import { Check, Search, Sparkles, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getDivineGodIconUrl } from '@/lib/deck-builder-assets'
import {
  formatCardDisplayDescription,
  mergeCardDisplayTags,
} from '../deck-builder-card-display.utils'
import type {
  DeckBuilderCommonEpiphany,
  DeckBuilderDivineEpiphany,
  DeckBuilderDivineGod,
  DeckBuilderEpiphanyVariant,
  DeckCardEpiphanySettings,
  VariantModalTarget,
} from '../deck-builder.types'
import {
  canUseDeckBuilderEpiphanies,
  DECK_BUILDER_DIVINE_GODS,
  getDisplayTypes,
  getVariants,
} from '../deck-builder.utils'
import commonEpiphaniesData from '../data/deck-builder-common-epiphanies.json'
import divineEpiphaniesData from '../data/deck-builder-divine-epiphanies.json'
import { CardImage } from './CardImage'
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
    tag => normalizeComparable(tag) !== 'sortie',
  )
}

function getVariantCardType(
  selectedVariant: DeckBuilderEpiphanyVariant | null,
) {
  return (
    (selectedVariant as { card_type?: string | null } | null)?.card_type ??
    null
  )
}

function getVariantTags(selectedVariant: DeckBuilderEpiphanyVariant | null) {
  return (
    (selectedVariant as { tags?: string[] | null } | null)?.tags ?? []
  )
}

function isPersonaDeckBuilderCard(card: { name?: string | null; effect_types?: string[] | null }) {
  const normalizedName = normalizeComparable(card.name)

  if (normalizedName === 'persona') {
    return true
  }

  return (card.effect_types ?? []).some(
    type => normalizeComparable(type) === 'persona',
  )
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

  rawTypes.forEach(type => {
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

  return requiredTypes.some(requiredType => {
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

  return levels.some(level => {
    const normalizedLevel = normalizeLevel(level)

    if (!normalizedLevel) {
      return false
    }

    if (normalizedLevel === 'x') {
      return true
    }

    if (normalizedLevel === currentLevel || normalizedLevel === currentCostText) {
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
    allowedClass => normalizeComparable(allowedClass) === normalizedCombatantClass,
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

  return normalizeComparable(item.god) === normalizeComparable(selectedDivineGod.id)
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
  return DIVINE_EPIPHANIES.filter(item => {
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
  return COMMON_EPIPHANIES.filter(item => {
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
  const selectedClassName = variant === 'divine'
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

            {cardTypes.slice(0, 2).map(type => (
              <TypeBadge key={type} type={type} />
            ))}

            {tags.slice(0, 2).map(tag => (
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
          {levels.slice(0, 4).map(level => (
            <MetadataPill key={level} variant="level">
              {`Lv ${level}`}
            </MetadataPill>
          ))}

          {allowedClasses.slice(0, 3).map(className => (
            <MetadataPill key={className}>
              {className}
            </MetadataPill>
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
        'grid h-9 w-9 place-items-center rounded-lg border bg-[#101018] transition',
        isSelected
          ? 'border-[#60a5fa] bg-[#082f49]/70 shadow-[0_0_0_1px_rgba(96,165,250,0.35)]'
          : 'border-[#303044] hover:border-[#c084fc]',
      ].join(' ')}
    >
      {iconUrl ? (
        <img
          src={iconUrl}
          alt={god.displayName}
          className="h-6 w-6 object-contain"
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
          {visibleTags.map(tag => (
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
        onChange={event => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#f97316]"
      />

      {label}
    </label>
  )
}

function AppliedEpiphanyItem({
  label,
  value,
  tone,
  iconUrl,
}: {
  label: string
  value?: string | null
  tone: 'god' | 'divine' | 'spark'
  iconUrl?: string | null
}) {
  if (!value?.trim()) {
    return null
  }

  const toneClassName = {
    god: 'border-[#38bdf8]/25 bg-[#0f172a]/90 text-[#dbeafe]',
    divine: 'border-[#a855f7]/35 bg-[#2e1065]/40 text-white',
    spark: 'border-[#facc15]/30 bg-[#422006]/45 text-white',
  }[tone]

  const labelClassName = {
    god: 'text-[#7dd3fc]',
    divine: 'text-[#c084fc]',
    spark: 'text-[#facc15]',
  }[tone]

  return (
    <div className={["rounded-lg border p-2.5", toneClassName].join(' ')}>
      <div className="mb-1 flex items-center gap-1.5">
        {iconUrl && (
          <img
            src={iconUrl}
            alt=""
            className="h-4 w-4 shrink-0 object-contain"
            draggable={false}
          />
        )}

        <p className={["text-[9px] font-black uppercase tracking-wide", labelClassName].join(' ')}>
          {label}
        </p>
      </div>

      <p
        title={value}
        className="line-clamp-3 text-[11px] font-black leading-snug text-white"
      >
        {value}
      </p>
    </div>
  )
}

function AppliedEpiphanyStack({
  selectedDivineGod,
  selectedDivineEpiphany,
  selectedCommonEpiphany,
}: {
  selectedDivineGod: DeckBuilderDivineGod | null
  selectedDivineEpiphany: DeckBuilderDivineEpiphany | null
  selectedCommonEpiphany: DeckBuilderCommonEpiphany | null
}) {
  const hasSelectedSettings = Boolean(
    selectedDivineGod ||
    selectedDivineEpiphany ||
    selectedCommonEpiphany,
  )

  if (!hasSelectedSettings) {
    return null
  }

  const selectedGodIconUrl = selectedDivineGod
    ? getDivineGodIconUrl(selectedDivineGod)
    : null

  return (
    <div className="mt-2 space-y-2">
      <AppliedEpiphanyItem
        label="Divine God"
        value={selectedDivineGod?.displayName}
        tone="god"
        iconUrl={selectedGodIconUrl}
      />

      <AppliedEpiphanyItem
        label="Divine Epiphany"
        value={selectedDivineEpiphany?.description}
        tone="divine"
      />

      <AppliedEpiphanyItem
        label="Spark Epiphany"
        value={selectedCommonEpiphany?.description}
        tone="spark"
      />
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

  const card = target.type === 'deck'
    ? target.card
    : target.item.card

  const variants = target.type === 'deck'
    ? target.variants
    : getVariants(target.item)

  const baseDescription = target.type === 'deck'
    ? target.description
    : target.item.description

  const isPersonaCard = isPersonaDeckBuilderCard(card)
  const canUseEpiphanies = canUseDeckBuilderEpiphanies(card)
  const canShowEpiphanySection = !isPersonaCard && (variants.length > 0 || canUseEpiphanies)
  const canShowEngravingSection = isPersonaCard
  const defaultInitialSection: ModalSection = target.type === 'deck'
    ? 'description'
    : canShowEngravingSection
      ? 'engraving'
      : 'epiphany'
  const normalizedInitialSection: ModalSection = initialSection === 'epiphany' && canShowEngravingSection
    ? 'engraving'
    : initialSection ?? defaultInitialSection

  const [activeSection, setActiveSection] = useState<ModalSection>(
    normalizedInitialSection,
  )

  const [searchText, setSearchText] = useState('')
  const [matchCurrentCard, setMatchCurrentCard] = useState(true)
  const [matchSelectedGod, setMatchSelectedGod] = useState(true)

  const [selectedVariant, setSelectedVariant] = useState<DeckBuilderEpiphanyVariant | null>(
    target.type === 'deck' ? target.selectedVariant ?? null : null,
  )

  const [selectedDivineGod, setSelectedDivineGod] = useState<DeckBuilderDivineGod | null>(
    target.type === 'deck' ? target.selectedDivineGod ?? null : null,
  )

  const [selectedDivineEpiphany, setSelectedDivineEpiphany] =
    useState<DeckBuilderDivineEpiphany | null>(
      target.type === 'deck' ? target.selectedDivineEpiphany ?? null : null,
    )

  const [selectedCommonEpiphany, setSelectedCommonEpiphany] =
    useState<DeckBuilderCommonEpiphany | null>(
      target.type === 'deck' ? target.selectedCommonEpiphany ?? null : null,
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

  const divineEpiphanies = useMemo(
    () => {
      if (!canUseEpiphanies) {
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
    },
    [
      canUseEpiphanies,
      combatantClass,
      currentCost,
      matchCurrentCard,
      matchSelectedGod,
      searchText,
      selectedDivineGod,
      selectedVariant,
      target,
    ],
  )

  const commonEpiphanies = useMemo(
    () => {
      if (!canUseEpiphanies) {
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
    },
    [
      canUseEpiphanies,
      combatantClass,
      currentCost,
      matchCurrentCard,
      searchText,
      selectedVariant,
      target,
    ],
  )

  useEffect(() => {
    if (
      selectedDivineEpiphany &&
      !divineEpiphanies.some(item => item.id === selectedDivineEpiphany.id)
    ) {
      setSelectedDivineEpiphany(null)
    }
  }, [divineEpiphanies, selectedDivineEpiphany])

  useEffect(() => {
    if (
      selectedCommonEpiphany &&
      !commonEpiphanies.some(item => item.id === selectedCommonEpiphany.id)
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

    if (onClearSettings) {
      onClearSettings()
    }
  }

  function handleApply() {
    onApplySettings({
      selectedVariant,
      selectedDivineGod,
      selectedDivineEpiphany,
      selectedCommonEpiphany,
    })

    onClose()
  }

  const displayTitle = selectedVariant?.name ?? card.name
  const footerGodText = selectedDivineGod?.displayName ?? t('deckBuilder.variantModal.noneGod')
  const footerSparkText = selectedCommonEpiphany?.description ?? t('deckBuilder.variantModal.noneSpark')

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
                      ? 'Engraving'
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

                  {(canShowEpiphanySection || canShowEngravingSection) && (
                    <button
                      type="button"
                      onClick={() => setActiveSection(canShowEngravingSection ? 'engraving' : 'epiphany')}
                      className={[
                        'rounded-full px-4 py-1.5 text-[11px] font-bold transition',
                        activeSection === (canShowEngravingSection ? 'engraving' : 'epiphany')
                          ? 'bg-[#075985] text-white shadow'
                          : 'text-[#a1a1aa] hover:text-white',
                      ].join(' ')}
                    >
                      {canShowEngravingSection ? 'Engraving' : t('deckBuilder.variantModal.epiphanyTab')}
                    </button>
                  )}
                </div>
              )}
            </div>

            <p className="mt-1 text-xs text-[#a1a1aa]">
              {target.type === 'deck'
                ? t('deckBuilder.variantModal.headerDescription')
                : (
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
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#aaa] hover:bg-[#242435] hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="min-h-0 space-y-3 overflow-y-auto pr-1">
            <section className="rounded-xl border border-[#303044] bg-[#171722] p-3">
              <p className="text-[10px] uppercase tracking-wide text-[#777]">
                {t('deckBuilder.variantModal.currentCard')}
              </p>

              <div className="mt-3 rounded-xl border border-[#333348] bg-[#101018] p-3">
                <div className="mx-auto h-[230px] w-full max-w-[190px] overflow-hidden rounded-lg border border-[#282838] bg-[#0f0f14]">
                  <CardImage
                    card={card}
                    variant="cover"
                    className="h-full w-full"
                  />
                </div>

                <div className="mt-3 flex items-start gap-2">
                  <span className="grid h-8 min-w-8 shrink-0 place-items-center rounded-md bg-[#0f172a] px-2 text-sm font-black text-[#93c5fd]">
                    {currentCost}
                  </span>

                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-black leading-tight text-white">
                      {displayTitle}
                    </p>

                    <p className="mt-1 text-[10px] font-semibold text-[#a1a1aa]">
                      Spark +{card.spark_count}
                    </p>
                  </div>
                </div>

                {currentDescription && (
                  <div className="mt-3 rounded-lg border border-[#0ea5e9]/25 bg-[#082f49]/25 p-2.5">
                    {currentDisplayTags.length > 0 && (
                      <div className="mb-1.5 flex flex-wrap gap-1">
                        {currentDisplayTags.slice(0, 4).map(type => (
                          <TypeBadge key={type} type={type} />
                        ))}
                      </div>
                    )}

                    <p className="line-clamp-4 text-[10px] font-semibold leading-snug text-[#dbeafe]">
                      {formattedCurrentDescription.text}
                    </p>
                  </div>
                )}
              </div>

              <AppliedEpiphanyStack
                selectedDivineGod={selectedDivineGod}
                selectedDivineEpiphany={selectedDivineEpiphany}
                selectedCommonEpiphany={selectedCommonEpiphany}
              />
            </section>

            {activeSection === 'epiphany' && canShowEpiphanySection && (
              <section className="rounded-xl border border-[#303044] bg-[#171722] p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-wide text-[#777]">
                    {t('deckBuilder.variantModal.divineGod')}
                  </p>

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

                <div className="mt-3 flex flex-wrap gap-2">
                  {DECK_BUILDER_DIVINE_GODS.map(god => (
                    <DivineGodButton
                      key={god.id}
                      god={god}
                      isSelected={selectedDivineGod?.id === god.id}
                      onClick={() => handleSelectGod(god)}
                    />
                  ))}
                </div>

                <label className="mt-3 flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-[#a1a1aa]">
                  <input
                    type="checkbox"
                    checked={matchSelectedGod}
                    onChange={event => setMatchSelectedGod(event.target.checked)}
                    className="h-4 w-4 accent-[#f97316]"
                  />

                  {t('deckBuilder.variantModal.matchSelectedGod')}
                </label>

                <p className="mt-2 line-clamp-2 text-[11px] text-[#888]">
                  {selectedDivineGod
                    ? t('deckBuilder.variantModal.filteringByGod', { god: selectedDivineGod.displayName })
                    : t('deckBuilder.variantModal.noDivineGodSelected')}
                </p>

                {combatantClass && (
                  <p className="mt-1 text-[11px] text-[#7dd3fc]">
                    {t('deckBuilder.variantModal.combatantClassLabel')}{' '}
                    <span className="font-bold">{combatantClass}</span>
                  </p>
                )}
              </section>
            )}
          </aside>

          <section className="min-h-0 min-w-0 overflow-hidden">
            {activeSection === 'description' ? (
              <section className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto rounded-xl border border-[#303044] bg-[#171722] p-4">
                <div className="rounded-xl border border-[#303044] bg-[#101018] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wide text-[#777]">
                        {t('deckBuilder.variantModal.card')}
                      </p>

                      <h3 className="mt-2 text-xl font-black leading-tight text-white">
                        {displayTitle}
                      </h3>

                      {currentDisplayTags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {currentDisplayTags.map(type => (
                            <TypeBadge key={type} type={type} />
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="grid h-11 min-w-11 shrink-0 place-items-center rounded-lg border border-[#075985] bg-[#082f49]/95 px-3 text-lg font-black text-[#93c5fd]">
                      {currentCost}
                    </span>
                  </div>

                  <div className="mt-4 border-t border-[#303044] pt-4">
                    <p className="text-[10px] uppercase tracking-wide text-[#777]">
                      {t('deckBuilder.variantModal.fullDescription')}
                    </p>

                    {currentDescription ? (
                      <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[#e5e7eb]">
                        {formattedCurrentDescription.text}
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-[#888]">
                        {t('deckBuilder.variantModal.noDescription')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-[#303044] bg-[#101018] p-4">
                    <p className="text-[10px] uppercase tracking-wide text-[#777]">
                      {t('deckBuilder.variantModal.damageStat')}
                    </p>
                    <p className="mt-2 text-lg font-black text-[#93c5fd]">
                      {card.eff_value > 0 ? `${card.eff_value}%` : '-'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#303044] bg-[#101018] p-4">
                    <p className="text-[10px] uppercase tracking-wide text-[#777]">
                      {t('deckBuilder.variantModal.hitsStat')}
                    </p>
                    <p className="mt-2 text-lg font-black text-white">
                      {card.hits > 0 ? card.hits : '-'}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#303044] bg-[#101018] p-4">
                    <p className="text-[10px] uppercase tracking-wide text-[#777]">
                      {t('deckBuilder.variantModal.sparkStat')}
                    </p>
                    <p className="mt-2 text-lg font-black text-[#facc15]">
                      +{card.spark_count}
                    </p>
                  </div>
                </div>
              </section>
            ) : activeSection === 'engraving' ? (
              <section className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
                <section className="rounded-xl border border-[#303044] bg-[#171722] p-4">
                  <p className="text-[10px] uppercase tracking-wide text-[#777]">
                    Engraving
                  </p>

                  <h3 className="mt-2 text-lg font-black text-white">
                    Persona Card
                  </h3>

                  <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#a1a1aa]">
                    Configure as Engravings da Persona Card. Esta seção substitui Epifania apenas para cartas Persona.
                  </p>
                </section>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <section className="rounded-xl border border-[#303044] bg-[#171722] p-4">
                    <p className="text-[10px] uppercase tracking-wide text-[#777]">
                      Slot 1
                    </p>

                    <p className="mt-2 text-sm font-bold text-white">
                      Nenhuma Engraving selecionada
                    </p>
                  </section>

                  <section className="rounded-xl border border-[#303044] bg-[#171722] p-4">
                    <p className="text-[10px] uppercase tracking-wide text-[#777]">
                      Slot 2
                    </p>

                    <p className="mt-2 text-sm font-bold text-white">
                      Nenhuma Engraving selecionada
                    </p>
                  </section>
                </div>
              </section>
            ) : (
              <section className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
                {variants.length > 0 && (
                  <section className="shrink-0 rounded-xl border border-[#303044] bg-[#171722] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-[#777]">
                          {t('deckBuilder.variantModal.variants')}
                        </p>

                        <p className="mt-1 text-[11px] text-[#888]">
                          {t('deckBuilder.variantModal.variantsFound', { count: variants.length })}
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

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {variants.map(variant => (
                        <VariantButton
                          key={variant.variant_id}
                          variant={variant}
                          isSelected={selectedVariant?.variant_id === variant.variant_id}
                          onClick={() => setSelectedVariant(variant)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                <section className="shrink-0 rounded-xl border border-[#303044] bg-[#171722] p-3">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                    <div className="relative min-w-0 flex-1">
                      <Search
                        size={15}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#777]"
                      />

                      <input
                        type="text"
                        value={searchText}
                        onChange={event => setSearchText(event.target.value)}
                        placeholder={t('deckBuilder.variantModal.searchEpiphanyText')}
                        className="h-9 w-full rounded-lg border border-[#303044] bg-[#101018] pl-9 pr-3 text-xs font-semibold text-white outline-none placeholder:text-[#777] focus:border-[#60a5fa]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <FilterCheckbox
                        checked={matchCurrentCard}
                        label={t('deckBuilder.variantModal.matchCurrentCard')}
                        onChange={setMatchCurrentCard}
                      />
                    </div>
                  </div>
                </section>

                {!canUseEpiphanies ? (
                  <section className="flex min-h-[260px] flex-1 items-center justify-center rounded-xl border border-dashed border-[#333348] bg-[#101018] p-6 text-center">
                    <div>
                      <p className="text-sm font-bold text-[#d1d5db]">
                        {t('deckBuilder.variantModal.noSparkCard')}
                      </p>

                      <p className="mt-1 text-xs text-[#888]">
                        {t('deckBuilder.variantModal.noSparkCardHint')}
                      </p>
                    </div>
                  </section>
                ) : (
                  <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-2">
                    <section className="flex min-h-0 flex-col rounded-xl border border-[#303044] bg-[#171722] p-3">
                      <div className="flex shrink-0 items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[#777]">
                            {t('deckBuilder.variantModal.divineEpiphany')}
                          </p>

                          <p className="mt-1 text-[11px] text-[#888]">
                            {t('deckBuilder.variantModal.compatibleOptions', { count: divineEpiphanies.length })}
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

                      <div className="mt-3 grid min-h-0 flex-1 auto-rows-min content-start items-start grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                        {divineEpiphanies.map(item => (
                          <EpiphanyOptionButton
                            key={item.id}
                            item={item}
                            variant="divine"
                            isSelected={selectedDivineEpiphany?.id === item.id}
                            onClick={() =>
                              setSelectedDivineEpiphany(current =>
                                current?.id === item.id ? null : item,
                              )
                            }
                          />
                        ))}
                      </div>
                    </section>

                    <section className="flex min-h-0 flex-col rounded-xl border border-[#303044] bg-[#171722] p-3">
                      <div className="flex shrink-0 items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide text-[#777]">
                            {t('deckBuilder.variantModal.sparkEpiphany')}
                          </p>

                          <p className="mt-1 text-[11px] text-[#888]">
                            {t('deckBuilder.variantModal.compatibleOptions', { count: commonEpiphanies.length })}
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

                      <div className="mt-3 grid min-h-0 flex-1 auto-rows-min content-start items-start grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                        {commonEpiphanies.map(item => (
                          <EpiphanyOptionButton
                            key={item.id}
                            item={item}
                            variant="spark"
                            isSelected={selectedCommonEpiphany?.id === item.id}
                            onClick={() =>
                              setSelectedCommonEpiphany(current =>
                                current?.id === item.id ? null : item,
                              )
                            }
                          />
                        ))}
                      </div>
                    </section>
                  </div>
                )}
              </section>
            )}
          </section>
        </div>

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-[#282838] px-4 py-3">
          {activeSection === 'epiphany' ? (
            <>
              <p className="min-w-0 truncate text-[11px] text-[#888]">
                {t('deckBuilder.variantModal.footerGod')}:{' '}
                <span className="font-bold text-[#dbeafe]">
                  {footerGodText}
                </span>

                <span className="mx-2 text-[#444]">|</span>

                {t('deckBuilder.variantModal.footerSpark')}:{' '}
                <span className="font-bold text-[#dbeafe]">
                  {footerSparkText}
                </span>
              </p>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={handleClearLocalSettings}
                  className="rounded-lg border border-[#7f1d1d] px-4 py-2 text-sm font-black text-[#fca5a5] hover:bg-[#7f1d1d]/20"
                >
                  {t('deckBuilder.clear')}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-[#333348] px-4 py-2 text-sm font-bold text-[#d1d5db] hover:bg-[#242435]"
                >
                  {t('deckBuilder.cancel')}
                </button>

                <button
                  type="button"
                  onClick={handleApply}
                  className="rounded-lg bg-[#2563eb] px-5 py-2 text-sm font-black text-white hover:bg-[#1d4ed8]"
                >
                  {t('deckBuilder.apply')}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[11px] text-[#777]">
                {activeSection === 'engraving' || canShowEngravingSection ? (
                  'Engraving'
                ) : (
                  <>
                    {t('deckBuilder.variantModal.footerHintPrefix')}{' '}<span className="font-bold text-[#7dd3fc]">{t('deckBuilder.variantModal.epiphanyTab')}</span>{' '}{t('deckBuilder.variantModal.footerHintSuffix')}
                  </>
                )}
              </p>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#333348] px-4 py-2 text-sm font-bold text-[#d1d5db] hover:bg-[#242435]"
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