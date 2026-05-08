package com.hubczn.optimizer.ui

import android.content.Context
import android.content.res.Configuration
import android.graphics.BitmapFactory
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.composables.icons.lucide.ChevronDown
import com.composables.icons.lucide.ChevronRight
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Pencil
import com.composables.icons.lucide.RefreshCw
import com.composables.icons.lucide.User
import com.hubczn.optimizer.data.local.ScanConfigStore
import com.hubczn.optimizer.data.repository.CharInfo
import com.hubczn.optimizer.data.repository.SetRepository
import com.hubczn.optimizer.logic.FragmentScorer
import com.hubczn.optimizer.model.Combatant
import com.hubczn.optimizer.model.MemoryFragment
import com.hubczn.optimizer.model.StatEntry
import com.hubczn.optimizer.ui.theme.CZNScannerTheme
import java.util.Locale

// ─── Theme tokens ──────────────────────────────────────────────────────────
private val BG_PAGE = Color(0xFF0E0E0E)
private val BG_CARD = Color(0xFF181818)
private val BG_PANEL = Color(0xFF141414)
private val BG_GEAR = Color(0xFF111827)
private val BORDER = Color(0xFF282828)
private val BORDER_2 = Color(0xFF2A2A2A)
private val TEXT_DIM = Color(0xFF888888)
private val TEXT_VERY_DIM = Color(0xFF555555)
private val TEXT_FAINT = Color(0xFF444444)
private val ACCENT = Color(0xFFC084FC)         // purple — replaces orange
private val ACCENT_SOFT = Color(0x33C084FC)
private val ACCENT_BG = Color(0x10C084FC)
private val GOLD = Color(0xFFFFD700)
private val PURPLE = Color(0xFFC084FC)
private val BLUE = Color(0xFF7C9FE8)

// Attribute name → asset filename in assets/attr/.
private val ATTR_ASSET: Map<String, String> = mapOf(
    "Passion"  to "icon_type_ego_passion.png",
    "Order"    to "icon_type_ego_order.png",
    "Justice"  to "icon_type_ego_justice.png",
    "Void"     to "icon_type_ego_void.png",
    "Instinct" to "icon_type_ego_instinct.png",
)

class CombatantsActivity : ComponentActivity() {

    private val viewModel: CombatantsViewModel by viewModels()

    override fun attachBaseContext(newBase: Context) {
        val lang = ScanConfigStore(newBase).languageOverride
        if (lang.isNullOrEmpty()) {
            super.attachBaseContext(newBase); return
        }
        val locale = Locale.forLanguageTag(lang)
        Locale.setDefault(locale)
        val cfg = Configuration(newBase.resources.configuration)
        cfg.setLocale(locale)
        super.attachBaseContext(newBase.createConfigurationContext(cfg))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CZNScannerTheme {
                CombatantsScreen(viewModel)
            }
        }
    }
}

@Composable
private fun CombatantsScreen(vm: CombatantsViewModel) {
    val state by vm.state.collectAsStateWithLifecycle()
    var expandedName by remember { mutableStateOf<String?>(null) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BG_PAGE)
            .windowInsetsPadding(WindowInsets.systemBars)
    ) {
        // Top bar — flat dark with purple accent.
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(BG_PAGE)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text("Combatants", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(state.sourceFile ?: "—", color = TEXT_VERY_DIM, fontSize = 9.sp)
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .clickable { vm.reload() }
                        .padding(8.dp)
                ) {
                    Icon(Lucide.RefreshCw, contentDescription = "Refresh", tint = ACCENT, modifier = Modifier.size(16.dp))
                }
            }
        }

        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = ACCENT)
            }
            state.error != null -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Lucide.User, contentDescription = null, tint = TEXT_VERY_DIM, modifier = Modifier.size(40.dp))
                    Text(state.error!!, color = TEXT_DIM, fontSize = 12.sp)
                }
            }
            state.combatants.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No combatants captured yet.", color = Color(0xFF666666), fontSize = 13.sp)
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    itemsIndexed(state.combatants) { idx, c ->
                        CombatantRow(
                            rank = idx + 1,
                            combatant = c,
                            charInfo = vm.charRepo.lookup(c.name),
                            setRepo = vm.setRepo,
                            expanded = expandedName == c.name,
                            onToggle = { expandedName = if (expandedName == c.name) null else c.name },
                            onEditEgo = { newEgo -> vm.setEgoOverride(c.name, newEgo) },
                            onEditStats = { newStats -> vm.setStatsOverride(c.name, newStats) },
                            onEditFragment = { slot, frag -> vm.setFragmentOverride(c.name, slot, frag) },
                        )
                    }
                }
            }
        }
    }
}

// ─── Row ────────────────────────────────────────────────────────────────────

@Composable
private fun CombatantRow(
    rank: Int,
    combatant: Combatant,
    charInfo: CharInfo?,
    setRepo: SetRepository,
    expanded: Boolean,
    onToggle: () -> Unit,
    onEditEgo: (Int) -> Unit,
    onEditStats: (com.hubczn.optimizer.model.CombatantStats) -> Unit,
    onEditFragment: (Int, com.hubczn.optimizer.model.MemoryFragment?) -> Unit,
) {
    var egoPickerOpen by remember(combatant.name) { mutableStateOf(false) }
    var statsEditorOpen by remember(combatant.name) { mutableStateOf(false) }
    var fragEditorSlot by remember(combatant.name) { mutableStateOf<Int?>(null) }
    val borderColor = if (expanded) ACCENT_SOFT else BORDER
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, borderColor, RoundedCornerShape(12.dp))
            .background(BG_CARD)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clickable { onToggle() }
                .background(if (expanded) ACCENT_BG else Color.Transparent)
                .padding(horizontal = 10.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Rank
            Text(
                "$rank",
                color = TEXT_FAINT,
                fontSize = 10.sp,
                modifier = Modifier.width(20.dp)
            )

            // Rectangular battle icon (replaces square face).
            BattleIcon(charInfo?.resId)

            // Name + level
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    combatant.name,
                    color = Color.White,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 13.sp,
                    maxLines = 1
                )
                Text(
                    "Lv. ${combatant.level}",
                    color = Color(0xFF666666),
                    fontSize = 10.sp
                )
            }

            // Attribute badge (icon if known, else fallback chip)
            AttrBadge(charInfo?.attribute)

            // Class pill
            charInfo?.charClass?.takeIf { it.isNotBlank() && it != "Unknown" }?.let { cls ->
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(4.dp))
                        .background(Color(0xFF232323))
                        .border(1.dp, Color(0xFF2E2E2E), RoundedCornerShape(4.dp))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(cls, color = TEXT_DIM, fontSize = 9.sp)
                }
            }

            // Ego Manifestation level (E0..E6). Clickable: opens a
            // picker so the user can manually correct an OCR mis-read.
            // E6 is highlighted gold — fully ascended on this game's
            // scale.
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(4.dp))
                    .clickable { egoPickerOpen = true }
                    .padding(horizontal = 4.dp, vertical = 2.dp)
            ) {
                Text(
                    "E${combatant.ego}",
                    color = if (combatant.ego >= 6) GOLD else TEXT_DIM,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold
                )
            }

            // GS column — average gear score across equipped fragments,
            // matches the desktop's headline number. Falls back to "—"
            // when the combatant has nothing equipped.
            val avgGs = remember(combatant) { FragmentScorer.averageGearScore(combatant.equippedFragments) }
            Column(horizontalAlignment = Alignment.End, modifier = Modifier.width(40.dp)) {
                if (avgGs > 0) {
                    Text(
                        "%.1f".format(avgGs),
                        color = ACCENT,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp
                    )
                } else {
                    Text("—", color = TEXT_FAINT, fontSize = 13.sp)
                }
                Text("GS", color = TEXT_VERY_DIM, fontSize = 9.sp)
            }

            Icon(
                if (expanded) Lucide.ChevronDown else Lucide.ChevronRight,
                contentDescription = null,
                tint = if (expanded) ACCENT else TEXT_FAINT,
                modifier = Modifier.size(14.dp)
            )
        }

        if (expanded) {
            ExpandedContent(
                combatant, charInfo, setRepo,
                onEditStatsClick = { statsEditorOpen = true },
                onEditFragmentClick = { slot -> fragEditorSlot = slot },
            )
        }
    }

    if (egoPickerOpen) {
        EgoPickerDialog(
            combatantName = combatant.name,
            current = combatant.ego,
            onPick = { v ->
                onEditEgo(v)
                egoPickerOpen = false
            },
            onDismiss = { egoPickerOpen = false }
        )
    }
    if (statsEditorOpen) {
        StatsEditDialog(
            combatantName = combatant.name,
            current = combatant.stats,
            onSave = { newStats ->
                onEditStats(newStats)
                statsEditorOpen = false
            },
            onDismiss = { statsEditorOpen = false },
        )
    }
    fragEditorSlot?.let { slot ->
        FragmentEditDialog(
            combatantName = combatant.name,
            slotNum = slot,
            current = combatant.equippedFragments.firstOrNull { it.slotNum == slot },
            onSave = { frag ->
                onEditFragment(slot, frag)
                fragEditorSlot = null
            },
            onClear = {
                onEditFragment(slot, null)
                fragEditorSlot = null
            },
            onDismiss = { fragEditorSlot = null },
        )
    }
}

@Composable
private fun EgoPickerDialog(
    combatantName: String,
    current: Int,
    onPick: (Int) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BG_CARD,
        title = {
            Text("Set Ego — $combatantName", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "Override the OCR-captured ego level. Saved to combatants_overrides.json and reapplied on every scan reload.",
                    color = TEXT_DIM, fontSize = 11.sp
                )
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    for (n in 0..6) {
                        val active = n == current
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(6.dp))
                                .background(if (active) ACCENT_BG else BG_PANEL)
                                .border(
                                    1.dp,
                                    if (active) ACCENT else BORDER,
                                    RoundedCornerShape(6.dp)
                                )
                                .clickable { onPick(n) }
                                .padding(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Text(
                                "E$n",
                                color = if (n == 6) GOLD else if (active) ACCENT else TEXT_DIM,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = TEXT_DIM)
            }
        }
    )
}

// ─── Expanded section ─────────────────────────────────────────────────────

@Composable
private fun ExpandedContent(
    combatant: Combatant,
    charInfo: CharInfo?,
    setRepo: SetRepository,
    onEditStatsClick: () -> Unit,
    onEditFragmentClick: (Int) -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(BG_PAGE)
            .border(0.dp, BORDER, RoundedCornerShape(0.dp))
    ) {
        // Layer 1: collapse character art, anchored bottom-left, fills height.
        CollapseArt(charInfo?.resId)

        // Layer 2: gradient that fades the art into the page background on the right.
        Box(
            modifier = Modifier
                .matchParentSize()
                .background(
                    Brush.horizontalGradient(
                        colorStops = arrayOf(
                            0.00f to Color.Transparent,
                            0.15f to BG_PAGE.copy(alpha = 0.55f),
                            0.35f to BG_PAGE.copy(alpha = 0.85f),
                            0.55f to BG_PAGE
                        )
                    )
                )
        )

        // Layer 3: stats panel (right-aligned, half width) + gear cards (full width).
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 10.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.End
            ) {
                Box(modifier = Modifier.fillMaxWidth(0.55f).alpha(0.78f)) {
                    StatsPanel(combatant, onEditClick = onEditStatsClick)
                }
            }

            // 3-column grid of fragment slots (matches desktop's mobile layout).
            for (rowSlots in (1..6).chunked(3)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    for (slotNum in rowSlots) {
                        val frag = combatant.equippedFragments.firstOrNull { it.slotNum == slotNum }
                        Box(modifier = Modifier.weight(1f)) {
                            GearSlotCard(slotNum, frag, setRepo, onEdit = { onEditFragmentClick(slotNum) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatsPanel(combatant: Combatant, onEditClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BG_PANEL.copy(alpha = 0.92f), RoundedCornerShape(8.dp))
            .border(1.dp, BORDER_2, RoundedCornerShape(8.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("STATS", color = ACCENT, fontSize = 8.sp, fontWeight = FontWeight.Bold)
            Box(
                modifier = Modifier
                    .clip(CircleShape)
                    .clickable { onEditClick() }
                    .padding(2.dp)
            ) {
                Icon(
                    Lucide.Pencil,
                    contentDescription = "Edit stats",
                    tint = ACCENT,
                    modifier = Modifier.size(11.dp)
                )
            }
        }
        StatLine("Attack",          combatant.stats.attack)
        StatLine("Defense",         combatant.stats.defense)
        StatLine("Health",          combatant.stats.health)
        StatLine("Critical Chance", combatant.stats.criticalChance, percent = true)
        StatLine("Critical Damage", combatant.stats.criticalDamage, percent = true)
    }
}

@Composable
private fun StatLine(label: String, value: Double, percent: Boolean = false) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = TEXT_DIM, fontSize = 10.sp)
        Text(
            if (percent) "%.1f%%".format(value) else value.toInt().toString(),
            color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold
        )
    }
}

// ─── Gear slot card ────────────────────────────────────────────────────────

@Composable
private fun GearSlotCard(slotNum: Int, frag: MemoryFragment?, setRepo: SetRepository, onEdit: () -> Unit) {
    val rarityColor = when (frag?.rarityNum) {
        5 -> GOLD
        4 -> PURPLE
        3 -> BLUE
        else -> TEXT_VERY_DIM
    }
    val borderAlpha = if (frag == null) 0.18f else 0.45f
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BG_GEAR.copy(alpha = 0.92f), RoundedCornerShape(6.dp))
            .border(1.dp, rarityColor.copy(alpha = borderAlpha), RoundedCornerShape(6.dp))
            .clickable { onEdit() }
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp)
    ) {
        if (frag == null) {
            // Empty slot placeholder.
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(romanNumeral(slotNum), color = TEXT_FAINT, fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Text("(empty)", color = TEXT_VERY_DIM, fontSize = 10.sp)
            return@Column
        }

        // Header: piece icon + set name truncated + "+N" upgrade badge.
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            PieceIcon(setName = frag.setName, slotNum = slotNum, setRepo = setRepo)
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    frag.setName.uppercase(),
                    color = TEXT_DIM,
                    fontSize = 8.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1
                )
                val main = frag.statList.firstOrNull()
                if (main != null) {
                    Text(
                        "${main.stat}: ${formatStatValue(main)}",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1
                    )
                }
            }
            Text("+${frag.level}", color = rarityColor, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }

        // Substats list (entries 1..) — each on its own line, with the
        // value AND its per-roll efficiency % alongside (mirrors desktop:
        // "» CRate    5.5%  92%"). Efficiency is colored by tier so the
        // eye picks up the strongest rolls without reading every digit.
        val substats = frag.statList.drop(1)
        if (substats.isNotEmpty()) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 2.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                    for (s in substats) {
                        val eff = FragmentScorer.efficiency(s)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(4.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            // Roll-count chevrons (» if extra_rolls >= 2, › if == 1, blank if 0).
                            val rollMark = when {
                                s.extraRolls >= 2 -> "» "
                                s.extraRolls == 1 -> "› "
                                else -> "  "
                            }
                            Text(
                                rollMark + s.stat,
                                color = TEXT_DIM,
                                fontSize = 9.sp,
                                maxLines = 1,
                                modifier = Modifier.weight(1f)
                            )
                            Text(
                                formatStatValue(s),
                                color = Color(0xFFB3B3B3),
                                fontSize = 9.sp,
                                fontWeight = FontWeight.Bold,
                                maxLines = 1
                            )
                            if (eff != null) {
                                val pct = (eff * 100).coerceIn(0.0, 100.0)
                                Text(
                                    "%d%%".format(pct.toInt()),
                                    color = efficiencyColor(pct),
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.width(28.dp),
                                    maxLines = 1
                                )
                            }
                        }
                    }
                }
            }
        }

        // Score + letter grade footer. Mirrors desktop's "Score 67.2 SSS".
        val score = remember(frag) { FragmentScorer.gearScore(frag) }
        val gradeBox = remember(score) { FragmentScorer.grade(score) }
        if (score > 0) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Score", color = TEXT_VERY_DIM, fontSize = 9.sp)
                    Text(
                        "%.1f".format(score),
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
                if (gradeBox != null) {
                    Text(
                        "(${gradeBox.label})",
                        color = Color(gradeBox.argbColor),
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
    }
}

/** Color ramp for per-roll substat efficiency, matches the grade hues. */
private fun efficiencyColor(pct: Double): Color = when {
    pct >= 93 -> Color(0xFFFFD700)  // SSS gold
    pct >= 86 -> Color(0xFFFF9D00)  // SS+ amber
    pct >= 79 -> Color(0xFFFF6B6B)  // SS red
    pct >= 70 -> Color(0xFFC084FC)  // S purple
    pct >= 61 -> Color(0xFF60A5FA)  // A blue
    pct >= 53 -> Color(0xFF4ADE80)  // B green
    else      -> Color(0xFF9CA3AF)  // C gray
}

private fun formatStatValue(s: StatEntry): String =
    if (s.type == "percent") "%.1f%%".format(s.value)
    else s.value.toInt().toString()

@Composable
private fun PieceIcon(setName: String, slotNum: Int, setRepo: SetRepository) {
    val context = LocalContext.current
    val bmp = remember(setName, slotNum) {
        val path = setRepo.pieceAssetPath(setName, slotNum) ?: return@remember null
        runCatching {
            context.assets.open(path).use { BitmapFactory.decodeStream(it) }
        }.getOrNull()
    }
    Box(
        modifier = Modifier
            .size(28.dp)
            .clip(RoundedCornerShape(4.dp))
            .background(Color(0xFF0A0A0A))
    ) {
        if (bmp != null) {
            Image(
                bitmap = bmp.asImageBitmap(),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Fit
            )
        }
    }
}

private fun romanNumeral(n: Int): String = when (n) {
    1 -> "I"; 2 -> "II"; 3 -> "III"; 4 -> "IV"; 5 -> "V"; 6 -> "VI"; else -> "$n"
}

// ─── Image components (asset-backed) ───────────────────────────────────────

@Composable
private fun BattleIcon(resId: Int?) {
    val context = LocalContext.current
    val bmp = remember(resId) {
        if (resId == null) null
        else runCatching {
            context.assets.open("tp_skill/battle_icon_tp_skill_$resId.png")
                .use { BitmapFactory.decodeStream(it) }
        }.getOrNull()
    }
    Box(
        modifier = Modifier
            .size(width = 56.dp, height = 36.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(Color(0xFF121212))
            .border(1.dp, Color(0xFF252525), RoundedCornerShape(6.dp))
    ) {
        if (bmp != null) {
            Image(
                bitmap = bmp.asImageBitmap(),
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop
            )
        }
    }
}

@Composable
private fun AttrBadge(attribute: String?) {
    val context = LocalContext.current
    val bmp = remember(attribute) {
        val asset = ATTR_ASSET[attribute] ?: return@remember null
        runCatching {
            context.assets.open("attr/$asset")
                .use { BitmapFactory.decodeStream(it) }
        }.getOrNull()
    }
    if (bmp != null) {
        Image(
            bitmap = bmp.asImageBitmap(),
            contentDescription = attribute,
            modifier = Modifier.size(20.dp),
            contentScale = ContentScale.Fit
        )
    } else if (!attribute.isNullOrBlank() && attribute != "Unknown") {
        Box(
            modifier = Modifier
                .clip(RoundedCornerShape(3.dp))
                .background(Color(0xFF282828))
                .border(1.dp, Color(0xFF333333), RoundedCornerShape(3.dp))
                .padding(horizontal = 4.dp, vertical = 1.dp)
        ) {
            Text(attribute, color = TEXT_DIM, fontSize = 9.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

/**
 * Character collapse art shown as a left-anchored background in the
 * expanded panel. Tries `_02` first (the larger/preferred render) and
 * falls back to `_01`. Renders nothing if neither asset is available.
 * Height matches the parent box; width is whatever the natural aspect
 * ratio yields (the gradient layer fades it into the page background).
 */
@Composable
private fun CollapseArt(resId: Int?) {
    val context = LocalContext.current
    val bmp = remember(resId) {
        if (resId == null) return@remember null
        listOf("02", "01").firstNotNullOfOrNull { variant ->
            runCatching {
                context.assets.open("collapse/collapse_${resId}_$variant.png")
                    .use { BitmapFactory.decodeStream(it) }
            }.getOrNull()
        }
    }
    if (bmp != null) {
        Image(
            bitmap = bmp.asImageBitmap(),
            contentDescription = null,
            modifier = Modifier.fillMaxHeight(),
            contentScale = ContentScale.FillHeight,
            alignment = Alignment.BottomStart
        )
    }
}
