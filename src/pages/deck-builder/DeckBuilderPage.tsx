import { useTranslation } from 'react-i18next'

export function DeckBuilderPage() {
  const { t } = useTranslation()

  return (
    <div className="min-h-full bg-[#121212] text-[#ffffff] p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="inline-flex items-center rounded-full border border-[#3a3a3a] px-3 py-1 text-xs font-medium text-[#c084fc]">
            beta
          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            {t('deckBuilder.title')}
          </h1>

          <p className="text-sm text-[#b3b3b3] max-w-2xl">
            {t('deckBuilder.description')}
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#282828] bg-[#181818] p-4">
            <p className="text-xs uppercase tracking-wide text-[#b3b3b3]">
              {t('deckBuilder.cardsSelected')}
            </p>
            <p className="mt-3 text-3xl font-bold">0</p>
          </div>

          <div className="rounded-xl border border-[#282828] bg-[#181818] p-4">
            <p className="text-xs uppercase tracking-wide text-[#b3b3b3]">
              {t('deckBuilder.deckCost')}
            </p>
            <p className="mt-3 text-3xl font-bold">0</p>
          </div>

          <div className="rounded-xl border border-[#282828] bg-[#181818] p-4">
            <p className="text-xs uppercase tracking-wide text-[#b3b3b3]">
              {t('deckBuilder.status')}
            </p>
            <p className="mt-3 text-sm font-medium text-[#c084fc]">
              {t('deckBuilder.empty')}
            </p>
          </div>
        </section>

        <section className="rounded-xl border border-dashed border-[#3a3a3a] bg-[#181818] p-8 text-center">
          <h2 className="text-lg font-semibold">
            {t('deckBuilder.placeholderTitle')}
          </h2>

          <p className="mt-2 text-sm text-[#b3b3b3]">
            {t('deckBuilder.placeholderDescription')}
          </p>
        </section>
      </div>
    </div>
  )
}