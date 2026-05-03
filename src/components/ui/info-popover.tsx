import * as React from 'react'
import { Popover } from 'radix-ui'

interface InfoPopoverProps {
  content: React.ReactNode
  className?: string
  ariaLabel?: string
}

export function InfoPopover({ content, className, ariaLabel = 'More information' }: InfoPopoverProps) {
  return (
    <Popover.Root>
      <Popover.Trigger
        type="button"
        className={`text-[#666] hover:text-[#999] cursor-pointer text-sm leading-none bg-transparent border-none p-0 inline-flex items-center${className ? ` ${className}` : ''}`}
        aria-label={ariaLabel}
      >
        ⓘ
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-[#1e1e1e] border border-[#444] rounded-md p-3 text-xs text-[#d4d4d4] shadow-xl max-w-[240px] z-50"
          sideOffset={4}
          onOpenAutoFocus={e => e.preventDefault()}
        >
          {content}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
