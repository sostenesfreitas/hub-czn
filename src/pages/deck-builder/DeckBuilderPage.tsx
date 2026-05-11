import { CombatantDeckColumn } from './components/CombatantDeckColumn'
import { DeckBuilderHeader } from './components/DeckBuilderHeader'
import { VariantSettingsModal } from './components/VariantSettingsModal'
import { useDeckBuilder } from './hooks/useDeckBuilder'

export function DeckBuilderPage() {
  const deckBuilder = useDeckBuilder()

  return (
    <div className="min-h-full bg-[#0f0f14] text-white">
      <DeckBuilderHeader
        selectedCombatants={deckBuilder.selectedCombatants}
        totalCards={deckBuilder.totalCards}
        totalCost={deckBuilder.totalCost}
        onReset={deckBuilder.resetBuilder}
        onImportDeck={deckBuilder.importDeck}
        onExportDeck={deckBuilder.exportDeck}
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
              onSelectCombatant={combatantId => deckBuilder.selectCombatant(index, combatantId)}
              onDuplicateCard={instanceId => deckBuilder.duplicateCard(index, instanceId)}
              onRemoveCard={instanceId => deckBuilder.removeCard(index, instanceId)}
              onAddDeckBuilderCard={item => deckBuilder.addDeckBuilderCard(index, item)}
              onOpenDeckCardVariants={item => deckBuilder.openDeckCardVariants(index, item)}
              onOpenAvailableCardVariants={item => deckBuilder.openAvailableCardVariants(index, item)}
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

      {deckBuilder.variantModalTarget && (
        <VariantSettingsModal
          target={deckBuilder.variantModalTarget}
          onClose={deckBuilder.closeVariantModal}
          onApplyVariant={deckBuilder.applyVariant}
          onClearVariant={
            deckBuilder.variantModalTarget.type === 'deck'
              ? deckBuilder.clearVariant
              : undefined
          }
        />
      )}
    </div>
  )
}
