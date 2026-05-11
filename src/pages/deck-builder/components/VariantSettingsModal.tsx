import { Sparkles, X } from 'lucide-react'
import type {
  DeckBuilderEpiphanyVariant,
  VariantModalTarget,
} from '../deck-builder.types'
import { getDisplayTypes, getVariants } from '../deck-builder.utils'
import { CardImage } from './CardImage'
import { TypeBadge } from './TypeBadge'

export function VariantSettingsModal({
  target,
  onClose,
  onApplyVariant,
  onClearVariant,
}: {
  target: VariantModalTarget
  onClose: () => void
  onApplyVariant: (variant: DeckBuilderEpiphanyVariant) => void
  onClearVariant?: () => void
}) {
  const card = target.type === 'deck'
    ? target.card
    : target.item.card

  const variants = target.type === 'deck'
    ? target.variants
    : getVariants(target.item)

  const selectedVariant = target.type === 'deck'
    ? target.selectedVariant
    : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
      <div className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[#303044] bg-[#15151f] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#282838] p-5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-[#7dd3fc]" />
              <h2 className="text-lg font-bold text-white">
                Epiphany Settings
              </h2>
            </div>

            <p className="mt-1 text-xs text-[#b3b3b3]">
              Selecione uma variante para <span className="font-semibold text-white">{card.name}</span>.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#aaa] hover:bg-[#242435] hover:text-white"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-xl border border-[#303044] bg-[#171722] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[#777]">
              Carta atual
            </p>

            <div className="mt-3 overflow-hidden rounded-lg border border-[#333348] bg-[#101018]">
              <div className="h-48 bg-[#101018] p-2">
                <CardImage card={card} variant="contain" />
              </div>

              <div className="p-3">
                <div className="flex items-start gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#0f172a] text-lg font-black text-[#93c5fd]">
                    {selectedVariant?.cost ?? card.cost}
                  </span>

                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-bold text-white">
                      {selectedVariant?.name ?? card.name}
                    </p>

                    {selectedVariant ? (
                      <p className="mt-1 text-[10px] text-[#7dd3fc]">
                        Base: {card.name}
                      </p>
                    ) : (
                      <p className="mt-1 text-[10px] text-[#888]">
                        Nenhuma variante aplicada.
                      </p>
                    )}
                  </div>
                </div>

                {selectedVariant && (
                  <div className="mt-3 rounded-md border border-[#0ea5e9]/30 bg-[#082f49]/30 p-2">
                    <div className="mb-1 flex flex-wrap gap-1">
                      {getDisplayTypes(card, selectedVariant).map(type => (
                        <TypeBadge key={type} type={type} />
                      ))}
                    </div>

                    <p className="text-[10px] leading-relaxed text-[#dbeafe]">
                      {selectedVariant.description}
                    </p>
                  </div>
                )}

                {selectedVariant && onClearVariant && (
                  <button
                    type="button"
                    onClick={onClearVariant}
                    className="mt-3 w-full rounded-lg border border-[#333348] px-3 py-2 text-xs font-semibold text-[#aaa] hover:border-[#f87171] hover:text-[#f87171]"
                  >
                    Remover variante
                  </button>
                )}
              </div>
            </div>
          </aside>

          <section className="rounded-xl border border-[#303044] bg-[#171722] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[#777]">
              Variantes disponíveis
            </p>

            <p className="mt-2 text-sm text-[#b3b3b3]">
              {variants.length} variantes encontradas
            </p>

            {variants.length === 0 ? (
              <div className="mt-4 flex h-64 items-center justify-center rounded-xl border border-dashed border-[#333348] text-sm text-[#888]">
                Nenhuma variante mapeada para esta carta.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {variants.map(variant => {
                  const isSelected = selectedVariant?.variant_id === variant.variant_id

                  return (
                    <button
                      key={variant.variant_id}
                      type="button"
                      onClick={() => onApplyVariant(variant)}
                      className={[
                        'rounded-lg border p-3 text-left transition-colors',
                        isSelected
                          ? 'border-[#7dd3fc] bg-[#082f49]/50'
                          : 'border-[#333348] bg-[#101018] hover:border-[#c084fc] hover:bg-[#1f1b2e]',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-bold text-white">
                            {variant.name}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1">
                            {getDisplayTypes(card, variant).map(type => (
                              <TypeBadge key={type} type={type} />
                            ))}
                          </div>
                        </div>

                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-[#0f172a] text-sm font-bold text-[#93c5fd]">
                          {variant.cost}
                        </span>
                      </div>

                      <p className="mt-3 text-xs leading-relaxed text-[#dbeafe]">
                        {variant.description}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[#282838] p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#333348] px-4 py-2 text-sm font-semibold text-[#d1d5db] hover:bg-[#242435]"
          >
            Fechar
          </button>
        </footer>
      </div>
    </div>
  )
}
