export type Lang = 'en' | 'pt-BR'

export type LocalizedText = Record<Lang, string>

export type Block =
  | { type: 'prose'; body: LocalizedText }
  | {
      type: 'card-list'
      intro?: LocalizedText
      items: { cardId: string; rating?: string; note: LocalizedText }[]
    }
  | {
      type: 'partner-list'
      items: { charResId: number; name: string; rating: string; note: LocalizedText }[]
    }
  | {
      type: 'gear-list'
      intro?: LocalizedText
      items: { image?: string; name: string; note?: LocalizedText }[]
    }
  | {
      type: 'rating-list'
      items: { label: string; text: LocalizedText }[]
    }
  | {
      type: 'team-grid'
      groups: { title?: LocalizedText; faces: number[] }[]
    }

export interface GuideSection {
  id: string
  title: LocalizedText
  blocks: Block[]
}

export interface GuideSource {
  url: string
  label: LocalizedText
}

export interface Guide {
  charResId: number
  name: string
  source?: GuideSource
  sections: GuideSection[]
}
