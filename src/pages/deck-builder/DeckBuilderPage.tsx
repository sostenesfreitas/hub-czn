import { useState } from 'react'
import type { CardCharacter } from '@/lib/types'
import { CombatantDeckColumn } from './components/CombatantDeckColumn'
import { DeckBuilderHeader } from './components/DeckBuilderHeader'
import {
  VariantSettingsModal,
  type VariantModalInitialSection,
} from './components/VariantSettingsModal'
import { useDeckBuilder } from './hooks/useDeckBuilder'

type DeckBuilderCardCharacter = CardCharacter & {
  class?: string | null
  attribute?: string | null
}

export function DeckBuilderPage() {
  const deckBuilder = useDeckBuilder()
  const variantModalTarget = deckBuilder.variantModalTarget
  const [variantModalInitialSection, setVariantModalInitialSection] =
    useState<VariantModalInitialSection>('epiphany')

  const variantModalCombatantClass = variantModalTarget
    ? (
        deckBuilder.characters.find(
          character =>
            character.char_res_id ===
            deckBuilder.squad[variantModalTarget.slotIndex]?.combatantId,
        ) as DeckBuilderCardCharacter | undefined
      )?.class ?? null
    : null

  return (
    <div className="min-h-full bg-[#0f0f14] text-white">
      <DeckBuilderHeader
        selectedCombatants={deckBuilder.selectedCombatants}
        totalCards={deckBuilder.totalCards}
        totalCost={deckBuilder.totalCost}
        savedDecks={deckBuilder.savedDecks}
        selectedSavedDeckId={deckBuilder.selectedSavedDeckId}
        onReset={deckBuilder.resetBuilder}
        onImportDeck={deckBuilder.importDeck}
        onExportDeck={deckBuilder.exportDeck}
        onLoadSavedDeck={deckBuilder.loadSavedDeck}
        onSaveCurrentDeck={deckBuilder.saveCurrentDeck}
        onSaveCurrentDeckAs={deckBuilder.saveCurrentDeckAs}
        onDeleteSavedDeck={deckBuilder.deleteSavedDeck}
      />

      {deckBuilder.isLoading ? (
        <div className="flex h-[calc(100vh-180px)] items-center justify-center text-sm text-[#888]">
          Carregando combatentes...
        </div>
      ) : (
        <main className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-3">
          {deckBuilder.squad.map((slot, index) => (
            <CombatantDeckColumn
              key={index}
              slotIndex={index}
              slot={slot}
              characters={deckBuilder.characters}
              onSelectCombatant={combatantId =>
                deckBuilder.selectCombatant(index, combatantId)
              }
              onDuplicateCard={instanceId =>
                deckBuilder.duplicateCard(index, instanceId)
              }
              onRemoveCard={instanceId =>
                deckBuilder.removeCard(index, instanceId)
              }
              onAddDeckBuilderCard={item =>
                deckBuilder.addDeckBuilderCard(index, item)
              }
              onOpenDeckCardVariants={(item, initialSection = 'epiphany') => {
                setVariantModalInitialSection(initialSection)
                deckBuilder.openDeckCardVariants(index, item)
              }}
              onOpenAvailableCardVariants={item => {
                setVariantModalInitialSection('epiphany')
                deckBuilder.openAvailableCardVariants(index, item)
              }}
              onSelectEquipment={(equipmentSlot, item) =>
                deckBuilder.selectEquipment(index, equipmentSlot, item)
              }
              onClearEquipment={equipmentSlot =>
                deckBuilder.clearEquipment(index, equipmentSlot)
              }
              onClearDeck={() => deckBuilder.clearDeck(index)}
            />
          ))}
        </main>
      )}

      {variantModalTarget && (
        <VariantSettingsModal
          target={variantModalTarget}
          combatantClass={variantModalCombatantClass}
          initialSection={variantModalInitialSection}
          onClose={deckBuilder.closeVariantModal}
          onApplySettings={deckBuilder.applyEpiphanySettings}
          onClearSettings={
            variantModalTarget.type === 'deck'
              ? deckBuilder.clearEpiphanySettings
              : undefined
          }
        />
      )}
    </div>
  )
}