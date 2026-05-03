# Autoscroll Confirmation Modal

**Date:** 2026-05-03
**Status:** Approved

## Summary

Replace the direct "Start Auto-scroll" button action with a one-time confirmation modal that teaches the user exactly where to position the cursor before the countdown begins. The modal has a "Don't show again" checkbox persisted in `localStorage`. The countdown duration increases from 3 s to 5 s.

---

## Problem

The current flow: user clicks "Start Auto-scroll" → 3-second countdown starts → autoscroll clicks whatever the cursor happens to be over. If the user doesn't know they need to position the cursor over the `›` (next-page) button in the game's Rescue Records screen first, the autoscroll fails silently or clicks the wrong area.

---

## Design

### Modal layout (Option A — approved)

A shadcn `Dialog` rendered inside `AutoScrollPanel`. Content:

1. **Header** — small label `"Auto-scroll de resgates"` + bold title `"Posicione o cursor antes de iniciar"`.
2. **Numbered steps** (3 steps):
   - Step 1: Open the **Rescue Records** tab in the game.
   - Step 2: Position the cursor over the **`›` (next page)** button at the bottom of the list.
   - Step 3: Click **Iniciar** in the app — a **5-second** countdown begins. Do not move the mouse.
3. **Mini game preview** — a small wireframe of the pagination row (`‹ 1 ›`) with the `›` button highlighted in purple, a cursor icon above it, and a "cursor aqui" label.
4. **"Don't show again" checkbox** — below the steps.
5. **Footer buttons** — "Cancelar" (outline) and "Iniciar Auto-scroll" (purple fill).

### "Don't show again" persistence

- Key: `localStorage.getItem('hub-czn:autoscroll-skip-modal')`
- Value: `'true'` when checkbox was checked and confirmed.
- On Start button click in the modal: if checkbox is checked → write to localStorage → call `start()`.
- On "Start Auto-scroll" button click in the panel (phase `idle`): if localStorage key is `'true'` → call `start()` directly (skip modal).

### Countdown change

- Backend: `_autoscroll_loop` in `api/routes/autoscroll.py` — change `range(3, 0, -1)` to `range(5, 0, -1)`.
- Frontend: i18n key `capture.autoscroll.position` is already dynamic (shows the countdown number from the WS message) — no change needed there.

---

## Files to change

| File | Change |
|------|--------|
| `src/pages/capture/CapturePage.tsx` | Add `AutoScrollConfirmModal` component; wire `start` through modal or direct call |
| `api/routes/autoscroll.py` | Countdown `range(3, 0, -1)` → `range(5, 0, -1)` |
| `src/i18n/en.ts` | Add modal i18n keys |
| `src/i18n/pt-BR.ts` | Add modal i18n keys (Portuguese) |

### New i18n keys

Keys use plain text. Bold/highlight styling is applied in the component with inline `<strong>` or `<span>` wrappers — not via HTML in i18n strings.

```
capture.autoscroll.modal.title          "Posicione o cursor antes de iniciar"
capture.autoscroll.modal.step1Pre       "Abra a aba"
capture.autoscroll.modal.step1Bold      "Rescue Records"
capture.autoscroll.modal.step1Post      "no jogo."
capture.autoscroll.modal.step2Pre       "Posicione o cursor sobre o botão"
capture.autoscroll.modal.step2Bold      "› (próxima página)"
capture.autoscroll.modal.step2Post      "no rodapé da lista."
capture.autoscroll.modal.step3Pre       "Clique"
capture.autoscroll.modal.step3Bold      "Iniciar"
capture.autoscroll.modal.step3Post      "— contagem de 5 segundos começa. Não mova o mouse."
capture.autoscroll.modal.skipLabel      "Não mostrar novamente"
capture.autoscroll.modal.cancel         "Cancelar"
capture.autoscroll.modal.confirm        "Iniciar Auto-scroll"
```

**Alternative (simpler):** Each step is a single key with the full sentence as plain text; the component wraps specific words in `<strong>` by hardcoding the bold parts per language. Given the text is short and non-dynamic, this is acceptable. Implementation team picks whichever is easier to maintain.

(English equivalents follow the same sentence structure.)

---

## Component structure

```
AutoScrollPanel (existing)
  └── AutoScrollConfirmModal (new, inline in the same file)
        ├── Dialog (shadcn)
        │     ├── DialogHeader — label + title
        │     ├── numbered steps (1–3)
        │     ├── MiniPaginationPreview (small inline component, pure JSX)
        │     ├── checkbox — "don't show again"
        │     └── DialogFooter — Cancel + Confirm buttons
        └── (Dialog only renders when `modalOpen` state is true)
```

`modalOpen` state lives in `AutoScrollPanel`. The existing `start()` function is called from the modal's confirm handler (and directly if localStorage skip flag is set).

---

## Behaviour details

- The modal opens when `phase === 'idle'` and the user clicks Start.
- If the localStorage key is already `'true'`, the modal is skipped entirely.
- Clicking Cancel closes the modal without calling `start()`.
- Clicking Confirm: saves localStorage if checkbox is checked, closes modal, calls `start()`.
- The checkbox state is local to the modal open/close cycle (defaults unchecked each open).
- No network calls are made until Confirm is clicked.

---

## Out of scope

- Resetting the "don't show again" preference (user can clear localStorage manually).
- Any changes to the autoscroll logic beyond countdown duration.
