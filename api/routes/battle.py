from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from api.frozen_path import add_vribbels_to_path
add_vribbels_to_path()

try:
    from game_data.characters import CHARACTERS as _CHARACTERS
except ImportError:
    _CHARACTERS = {}

# Characters whose damage scales with DEF instead of ATK (node_50 = "DEF%")
_DEF_SCALE_IDS: set[int] = {
    res_id for res_id, c in _CHARACTERS.items()
    if c and c.get("node_50") == "DEF%"
}

router = APIRouter()


def _snapshots_dir() -> Path:
    try:
        from capture.constants import OUTPUT_DIR
        return Path(OUTPUT_DIR)
    except Exception:
        return Path.home() / ".czn_optimizer" / "snapshots"


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class BattleRecord(BaseModel):
    capture_time: str = ""
    enemy_def: float = 0
    enemy_atk: float = 0
    enemy_dmg_decrease: float = 0
    battle_result: str | None = None
    mvp_res_id: str | None = None
    char_dpt: dict[str, float] = Field(default_factory=dict)
    player_chars: list[dict] = Field(default_factory=list)


class CharAnalysis(BaseModel):
    res_id: str
    scale_stat: str          # "atk" | "def"
    atk: float               # primary scaling stat (ATK for most, DEF for DEF-scalers)
    crate: float
    cdmg: float
    crit_factor: float
    dmg_per_100coeff: float
    priority: str          # "crate" | "cdmg" | "atk" | "balanced"
    tip: str
    crate_gain_10pp: float
    cdmg_gain_30pct: float
    atk_gain_10pct: float


class BattleAnalytics(BaseModel):
    capture_time: str
    enemy_def: float
    def_factor: float
    battle_result: str | None
    chars: list[CharAnalysis]


class OverviewSummary(BaseModel):
    total: int
    win_rate: float
    avg_enemy_def: float
    avg_team_dmg: float
    last_battle_time: str | None


class InsightCard(BaseModel):
    level: str        # "urgent" | "warning" | "positive"
    title: str
    description: str
    action: str
    char_res_id: str | None


class CharTrend(BaseModel):
    res_id: str
    battle_count: int
    avg_dpt: float
    dpt_trend_pct: float
    dpt_sparkline: list[float]
    latest_atk: float
    latest_crate: float
    latest_cdmg: float
    priority: str
    breakeven_delta: float


class RecentResult(BaseModel):
    capture_time: str
    battle_result: str | None
    enemy_def: float
    total_team_dmg: float
    mvp_res_id: str | None


class BattleOverview(BaseModel):
    summary: OverviewSummary
    insights: list[InsightCard]
    chars: list[CharTrend]
    recent: list[RecentResult]


# ---------------------------------------------------------------------------
# Analytics logic
# ---------------------------------------------------------------------------

def _analyze_char(char: dict, enemy_def: float) -> CharAnalysis:
    res_id_int = int(char.get("res_id", 0))
    is_def_scale = res_id_int in _DEF_SCALE_IDS
    scale_stat = "def" if is_def_scale else "atk"
    stat_label = "DEF" if is_def_scale else "ATK"

    atk   = float(char.get("atk", 0))
    primary = float(char.get("def", 0)) if is_def_scale else atk
    crate = min(float(char.get("cri", 0)), 100.0)
    cdmg  = float(char.get("cri_dmg", 0))

    def_factor = 300 / (300 + enemy_def) if enemy_def >= 0 else 1.0

    def crit_factor_of(r: float, d: float) -> float:
        return (r / 100) * (d / 100) + (1 - r / 100)

    cf      = crit_factor_of(crate, cdmg)
    dmg_100 = primary * cf * def_factor

    # Absolute damage gains for display
    cf_crate10 = crit_factor_of(min(crate + 10, 100.0), cdmg)
    cf_cdmg30  = crit_factor_of(crate, cdmg + 30)
    crate_gain = (cf_crate10 / cf - 1) * 100 if cf > 0 else 0.0
    cdmg_gain  = (cf_cdmg30  / cf - 1) * 100 if cf > 0 else 0.0
    atk_gain   = 10.0

    # Per-roll damage gain comparison
    # CRate max substat roll = 2pp; CDmg max substat roll = 4%
    # Breakeven: CDmg = 2*CRate + 100 (below → CDmg wins; above → CRate wins)
    cf_plus_crate = crit_factor_of(min(crate + 2, 100.0), cdmg)
    cf_plus_cdmg  = crit_factor_of(crate, cdmg + 4)
    crate_per_roll = (cf_plus_crate / cf - 1) * 100 if cf > 0 else 0.0
    cdmg_per_roll  = (cf_plus_cdmg  / cf - 1) * 100 if cf > 0 else 0.0

    MARGIN = 1.20  # need 20% lead to call a clear winner

    if crate < 20:
        priority = "crate"
        tip = (
            f"CRate {crate:.0f}% extremamente baixa — quase sem criticos. "
            f"Priorize CRate urgentemente. +10pp CRate = +{crate_gain:.1f}% dano"
        )
    elif crate_per_roll >= cdmg_per_roll * MARGIN:
        priority = "crate"
        tip = (
            f"CRate {crate:.0f}% rende mais por roll que CDmg {cdmg:.0f}%. "
            f"+10pp CRate: +{crate_gain:.1f}% | +30% CDmg: +{cdmg_gain:.1f}% | +10% {stat_label}: +{atk_gain:.1f}%"
        )
    elif cdmg_per_roll >= crate_per_roll * MARGIN:
        priority = "cdmg"
        tip = (
            f"CDmg {cdmg:.0f}% rende mais por roll que CRate {crate:.0f}%. "
            f"+30% CDmg: +{cdmg_gain:.1f}% | +10pp CRate: +{crate_gain:.1f}% | +10% {stat_label}: +{atk_gain:.1f}%"
        )
    else:
        priority = "balanced"
        tip = (
            f"CRate {crate:.0f}% e CDmg {cdmg:.0f}% estao proximos do equilibrio — "
            f"foque em {stat_label} ou melhore o deck. "
            f"+10pp CRate: +{crate_gain:.1f}% | +30% CDmg: +{cdmg_gain:.1f}% | +10% {stat_label}: +{atk_gain:.1f}%"
        )

    return CharAnalysis(
        res_id=str(char.get("res_id", "")),
        scale_stat=scale_stat,
        atk=round(primary, 1),
        crate=round(crate, 1),
        cdmg=round(cdmg, 1),
        crit_factor=round(cf, 3),
        dmg_per_100coeff=round(dmg_100, 0),
        priority=priority,
        tip=tip,
        crate_gain_10pp=round(crate_gain, 1),
        cdmg_gain_30pct=round(cdmg_gain, 1),
        atk_gain_10pct=round(atk_gain, 1),
    )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _load_battle(path: Path) -> BattleRecord | None:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return BattleRecord(**data)
    except Exception:
        return None


def _latest_battle_data(snap_dir: Path) -> dict:
    latest = snap_dir / "battle_latest.json"
    if latest.exists():
        try:
            return json.loads(latest.read_text(encoding="utf-8"))
        except Exception:
            pass
    files = sorted(snap_dir.glob("battle_*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    if not files:
        raise HTTPException(status_code=404, detail="No battle data captured yet")
    try:
        return json.loads(files[0].read_text(encoding="utf-8"))
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to parse battle data")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.get("/battle/latest")
def get_latest_battle() -> BattleRecord:
    snap_dir = _snapshots_dir()
    data = _latest_battle_data(snap_dir)
    return BattleRecord(**data)


@router.get("/battle/history")
def get_battle_history(limit: int = 20) -> list[BattleRecord]:
    snap_dir = _snapshots_dir()
    files = sorted(snap_dir.glob("battle_*.json"), key=lambda f: f.stat().st_mtime, reverse=True)
    result = []
    for f in files[:limit]:
        rec = _load_battle(f)
        if rec is not None:
            result.append(rec)
    return result


def _all_battle_files(snap_dir: Path) -> list[Path]:
    files = sorted(snap_dir.glob("battle_*.json"), key=lambda f: f.stat().st_mtime)
    return [f for f in files if f.name != "battle_latest.json"]


def _compute_overview_summary(records: list[dict]) -> OverviewSummary:
    total = len(records)
    wins = sum(1 for r in records if r.get("battle_result") == "CLEAR")
    win_rate = round((wins / total) * 100, 1) if total > 0 else 0.0
    avg_enemy_def = round(sum(float(r.get("enemy_def", 0)) for r in records) / total, 1) if total > 0 else 0.0
    team_dmgs = [
        sum(float(v) for v in r.get("char_dpt", {}).values())
        for r in records if r.get("char_dpt")
    ]
    avg_team_dmg = round(sum(team_dmgs) / len(team_dmgs), 0) if team_dmgs else 0.0
    last_battle_time = records[-1].get("capture_time") if records else None
    return OverviewSummary(
        total=total,
        win_rate=win_rate,
        avg_enemy_def=avg_enemy_def,
        avg_team_dmg=avg_team_dmg,
        last_battle_time=last_battle_time,
    )


def _compute_char_trends(records: list[dict]) -> list[CharTrend]:
    char_appearances: dict[str, list[dict]] = defaultdict(list)
    char_dpt_values: dict[str, list[float]] = defaultdict(list)
    latest_enemy_def = float(records[-1].get("enemy_def", 0)) if records else 0.0

    for rec in records:
        dpt_data = rec.get("char_dpt", {})
        for char in rec.get("player_chars", []):
            res_id = str(char.get("res_id", ""))
            if not res_id:
                continue
            char_appearances[res_id].append(char)
            if res_id in dpt_data:
                char_dpt_values[res_id].append(float(dpt_data[res_id]))

    trends: list[CharTrend] = []
    for res_id, appearances in char_appearances.items():
        if len(appearances) < 2:
            continue
        latest = appearances[-1]
        dpt_vals = char_dpt_values[res_id]
        avg_dpt = round(sum(dpt_vals) / len(dpt_vals), 0) if dpt_vals else 0.0

        if len(dpt_vals) >= 4:
            mid = len(dpt_vals) // 2
            first_avg = sum(dpt_vals[:mid]) / mid
            second_avg = sum(dpt_vals[mid:]) / len(dpt_vals[mid:])
            dpt_trend_pct = round((second_avg / first_avg - 1) * 100, 1) if first_avg > 0 else 0.0
        else:
            dpt_trend_pct = 0.0

        if dpt_vals:
            last_n = dpt_vals[-min(8, len(dpt_vals)):]
            max_dpt = max(last_n)
            dpt_sparkline = [round(v / max_dpt, 3) if max_dpt > 0 else 0.0 for v in last_n]
        else:
            dpt_sparkline = []

        analysis = _analyze_char(latest, latest_enemy_def)
        crate = float(latest.get("cri", 0))
        cdmg = float(latest.get("cri_dmg", 0))
        breakeven_delta = round(cdmg - (2 * crate + 100), 1)

        trends.append(CharTrend(
            res_id=res_id,
            battle_count=len(appearances),
            avg_dpt=avg_dpt,
            dpt_trend_pct=dpt_trend_pct,
            dpt_sparkline=dpt_sparkline,
            latest_atk=round(float(latest.get("atk", 0)), 1),
            latest_crate=round(crate, 1),
            latest_cdmg=round(cdmg, 1),
            priority=analysis.priority,
            breakeven_delta=breakeven_delta,
        ))

    trends.sort(key=lambda t: t.avg_dpt, reverse=True)
    return trends


def _compute_insights(records: list[dict], chars: list[CharTrend]) -> list[InsightCard]:
    insights: list[InsightCard] = []

    # Rule 1: CRate extremamente baixa (< 30%)
    for char in chars:
        if char.latest_crate < 30:
            insights.append(InsightCard(
                level="urgent",
                title="CRate Crítica",
                description=f"CRate {char.latest_crate:.0f}% — quase sem críticos. Priorize CRate urgentemente.",
                action="Mire em pelo menos 50% de CRate",
                char_res_id=char.res_id,
            ))
            if len(insights) >= 4:
                return insights

    # Rule 2: CDmg > 2×CRate+100 with gap > 30pp → CRate priority
    for char in chars:
        if char.latest_crate >= 30 and char.breakeven_delta > 30:
            insights.append(InsightCard(
                level="urgent",
                title="CDmg acima do breakeven",
                description=(
                    f"CDmg {char.latest_cdmg:.0f}% vs CRate {char.latest_crate:.0f}%: "
                    f"gap de {char.breakeven_delta:.0f}pp acima do breakeven. CRate rende mais agora."
                ),
                action="Priorize CRate no próximo upgrade",
                char_res_id=char.res_id,
            ))
            if len(insights) >= 4:
                return insights

    # Rule 3: 1 char responsible for > 55% of avg team DMG
    if chars:
        total_avg_dpt = sum(c.avg_dpt for c in chars)
        if total_avg_dpt > 0:
            for char in chars:
                share = char.avg_dpt / total_avg_dpt
                if share > 0.55:
                    insights.append(InsightCard(
                        level="warning",
                        title="Dependência de carry",
                        description=(
                            f"Um personagem responsável por {share * 100:.0f}% do dano médio da equipe. "
                            f"Upgrades nos demais membros aumentariam a consistência."
                        ),
                        action="Melhore os demais membros do time",
                        char_res_id=char.res_id,
                    ))
                    if len(insights) >= 4:
                        return insights
                    break

    # Rule 4: avg DEF last 3 > prior avg by > 20%
    if len(records) >= 4:
        last_3_def = [float(r.get("enemy_def", 0)) for r in records[-3:]]
        prior_def = [float(r.get("enemy_def", 0)) for r in records[:-3]]
        avg_last_3 = sum(last_3_def) / 3
        avg_prior = sum(prior_def) / len(prior_def)
        if avg_prior > 0 and (avg_last_3 / avg_prior - 1) > 0.20:
            pct_increase = round((avg_last_3 / avg_prior - 1) * 100, 0)
            insights.append(InsightCard(
                level="warning",
                title="Inimigos mais difíceis",
                description=(
                    f"DEF médio das últimas 3 batalhas ({avg_last_3:.0f}) é "
                    f"{pct_increase:.0f}% maior que o anterior ({avg_prior:.0f})."
                ),
                action="Revise a DEF do inimigo no Simulador",
                char_res_id=None,
            ))
            if len(insights) >= 4:
                return insights

    # Rule 5: dpt_trend_pct > +10%
    for char in chars:
        if char.dpt_trend_pct > 10:
            insights.append(InsightCard(
                level="positive",
                title="Personagem evoluindo",
                description=f"+{char.dpt_trend_pct:.0f}% de melhoria de DPT detectada. Continue investindo!",
                action="Mantenha o ritmo de upgrade",
                char_res_id=char.res_id,
            ))
            if len(insights) >= 4:
                return insights

    return insights


def _compute_recent_results(records: list[dict]) -> list[RecentResult]:
    recent = []
    for rec in reversed(records[-10:]):
        dpt_data = rec.get("char_dpt", {})
        total_team_dmg = sum(float(v) for v in dpt_data.values()) if dpt_data else 0.0
        mvp = rec.get("mvp_res_id")
        recent.append(RecentResult(
            capture_time=rec.get("capture_time", ""),
            battle_result=rec.get("battle_result"),
            enemy_def=float(rec.get("enemy_def", 0)),
            total_team_dmg=round(total_team_dmg, 0),
            mvp_res_id=str(mvp) if mvp is not None else None,
        ))
    return recent


@router.get("/battle/analytics")
def get_battle_analytics() -> BattleAnalytics:
    snap_dir = _snapshots_dir()
    data = _latest_battle_data(snap_dir)

    enemy_def    = float(data.get("enemy_def", 0))
    def_factor   = round(300 / (300 + enemy_def), 4) if enemy_def >= 0 else 1.0
    player_chars = data.get("player_chars", [])

    chars = [_analyze_char(c, enemy_def) for c in player_chars]
    chars.sort(key=lambda x: x.dmg_per_100coeff, reverse=True)

    return BattleAnalytics(
        capture_time=data.get("capture_time", ""),
        enemy_def=enemy_def,
        def_factor=def_factor,
        battle_result=data.get("battle_result"),
        chars=chars,
    )


@router.get("/battle/overview")
def get_battle_overview() -> BattleOverview:
    snap_dir = _snapshots_dir()
    files = _all_battle_files(snap_dir)
    if not files:
        raise HTTPException(status_code=404, detail="No battle data captured yet")

    records: list[dict] = []
    for f in files:
        try:
            records.append(json.loads(f.read_text(encoding="utf-8")))
        except Exception:
            continue

    if not records:
        raise HTTPException(status_code=404, detail="No battle data captured yet")

    summary = _compute_overview_summary(records)
    chars = _compute_char_trends(records)
    insights = _compute_insights(records, chars)
    recent = _compute_recent_results(records)

    return BattleOverview(summary=summary, insights=insights, chars=chars, recent=recent)
