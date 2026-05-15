# Sprint 2h7 Conclusion — additional_attack reaction chains v2

## Verdict: H1 confirmed

The empirical data from `condition_chain_analysis.txt` (134,949 ConditionTriggered events across 4 captures) supports **H1**: chain SkillEffs already dispatch correctly via the existing dev_msg-order pipeline. No new implementation is required for reaction chains.

## Evidence summary

| Metric | Value |
|---|---|
| Total ConditionTriggeredEvents | 134,949 |
| Followed by SkillEffEvent | 11,985 (8.9%) |
| Followed by another ConditionTriggered | 99,710 (73.9%) |
| Followed by TimingEvent | 16,671 (12.4%) |
| Followed by StackAdd | 6,177 (4.6%) |
| SkillEff follow-ups: status=dispatched | 9,175 (76.6%) |
| SkillEff follow-ups: status=missing | 786 (6.6%) |
| SkillEff follow-ups: status=no_target | 2,024 (16.9%) |

## Why this rules out the alternative hypotheses

**H2 ruled out**: If the server emitted ConditionTriggered without an accompanying SkillEff line and expected the simulator to derive the chained action from client_db, we'd expect a much higher proportion of ConditionTriggered events to be followed by NON-SkillEff events that look like silent triggers. Instead, 73.9% are followed by another ConditionTriggered (the server emitting cascading condition fires) and 12.4% by TimingEvent (frame boundaries). These follow-ups are **expected** event-stream noise, not missing actions. The 8.9% that DO have a SkillEff follow-up demonstrate the server emits the chain effect explicitly when one exists.

**H3 partially relevant but already addressed**: The 23.4% of follow-up SkillEffs that are NOT dispatched (786 missing + 2024 no_target) represent attribution/resolver issues, not a chain-reaction architecture problem. These are the same fall-through patterns that sprints 2g1–2g4 already addressed in bulk. The diagnostic confirms these are pre-existing resolver edge cases — not a new pattern that "reaction chains v2" would unlock.

**Damage chains are rare**: Only 409 of the 11,985 follow-up SkillEffs (3.4%) are damage events (`SKILL_EFF_DMG` 214 + `SKILL_EFF_DMG_IGNORE_COND` 195). The dominant follow-up category is the `CS_SET_ADD` family (8,667 = 72.3%) — buffs, conditions, and stat mutations. Whatever marginal Track B damage delta exists from undispatched chain DMG events is bounded by this tiny slice, and most of it falls under existing resolver issues already tracked in the 2g* line.

## Conclusion

The Sprint 2d design ("ConditionTriggeredEvent accumulator records, harness treats as no-op") is correct. The follow-up SkillEffs that comprise the actual "chain" are emitted by the server in dev_msg order and dispatched by the existing pipeline. The "additional_attack reaction chains v2" memory queue item is **obsolete**.

No T3 implementation work is warranted in this sprint.

## Recommended follow-up

- Mark "reaction chains v2" complete/obsolete in the memory queue.
- Move on to Sprint 2h8 items: per-card AoE detection, monster DEF refinement, generic Combobox primitive.
- If a future sprint wants to chip away at the 23.4% undispatched follow-ups, that work belongs in the 2g* resolver track, not a chain-specific track.
