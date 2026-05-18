import { Fragment } from 'react'
import { matcher } from '../encyclopedia-content'
import { linkDescription } from '../encyclopedia.utils'
import { GlossaryTerm } from './GlossaryTerm'

export function RichDescription({ text, className }: { text: string; className?: string }) {
  const segments = linkDescription(text, matcher)
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.kind === 'term' ? (
          <GlossaryTerm key={i} termId={seg.termId}>
            {seg.value}
          </GlossaryTerm>
        ) : (
          <Fragment key={i}>{seg.value}</Fragment>
        ),
      )}
    </span>
  )
}
