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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.composables.icons.lucide.Lucide
import com.composables.icons.lucide.Puzzle
import com.composables.icons.lucide.RefreshCw
import com.hubczn.optimizer.data.local.ScanConfigStore
import com.hubczn.optimizer.data.repository.SetRepository
import com.hubczn.optimizer.logic.FragmentScorer
import com.hubczn.optimizer.model.MemoryFragment
import com.hubczn.optimizer.model.StatEntry
import com.hubczn.optimizer.ui.theme.CZNScannerTheme
import java.util.Locale

private val BG_PAGE = Color(0xFF0E0E0E)
private val BG_CARD = Color(0xFF181818)
private val BG_PANEL = Color(0xFF111827)
private val BORDER = Color(0xFF282828)
private val TEXT_DIM = Color(0xFF888888)
private val TEXT_VERY_DIM = Color(0xFF555555)
private val TEXT_FAINT = Color(0xFF404040)
private val ACCENT = Color(0xFFC084FC)
private val GOLD = Color(0xFFFFD700)
private val PURPLE = Color(0xFFC084FC)
private val BLUE = Color(0xFF7C9FE8)

// Mirrors the desktop's per-rarity colour map.
private val RARITY_COLOR: Map<Int, Color> = mapOf(
    5 to GOLD,
    4 to PURPLE,
    3 to BLUE,
    2 to Color(0xFF84CC16),
    1 to Color(0xFFA8A29E),
)

class FragmentsActivity : ComponentActivity() {

    private val viewModel: FragmentsViewModel by viewModels()

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
                FragmentsScreen(viewModel)
            }
        }
    }
}

private enum class SortKey { Slot, Rarity, Level, Score, Set }

@Composable
private fun FragmentsScreen(vm: FragmentsViewModel) {
    val state by vm.state.collectAsStateWithLifecycle()
    var sortKey by remember { mutableStateOf(SortKey.Score) }
    var sortDesc by remember { mutableStateOf(true) }
    var slotFilter by remember { mutableStateOf<Int?>(null) }   // null = all
    var rarityFilter by remember { mutableStateOf<Int?>(null) } // null = all

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BG_PAGE)
            .windowInsetsPadding(WindowInsets.systemBars)
    ) {
        // Top bar
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(BG_PAGE)
                .padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Lucide.Puzzle, contentDescription = null, tint = ACCENT, modifier = Modifier.size(18.dp))
                Text(
                    "Memory Fragments",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 18.sp
                )
                Text(
                    "(${state.fragments.size})",
                    color = TEXT_DIM,
                    fontSize = 12.sp
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(state.sourceFile ?: "—", color = TEXT_VERY_DIM, fontSize = 9.sp, maxLines = 1)
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

        // Sort + filter controls
        FilterBar(
            slotFilter, rarityFilter, sortKey, sortDesc,
            onSlotChange = { slotFilter = it },
            onRarityChange = { rarityFilter = it },
            onSortKeyChange = { sortKey = it },
            onSortDirToggle = { sortDesc = !sortDesc },
        )

        when {
            state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = ACCENT)
            }
            state.error != null -> Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Icon(Lucide.Puzzle, contentDescription = null, tint = TEXT_VERY_DIM, modifier = Modifier.size(40.dp))
                    Text(state.error!!, color = TEXT_DIM, fontSize = 12.sp)
                }
            }
            state.fragments.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No fragments captured yet.", color = Color(0xFF666666), fontSize = 13.sp)
            }
            else -> {
                val visible = remember(state.fragments, slotFilter, rarityFilter, sortKey, sortDesc) {
                    state.fragments
                        .asSequence()
                        .filter { slotFilter == null || it.slotNum == slotFilter }
                        .filter { rarityFilter == null || it.rarityNum == rarityFilter }
                        .sortedWith(comparator(sortKey, sortDesc))
                        .toList()
                }

                LazyColumn(
                    modifier = Modifier.weight(1f),
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    items(visible, key = { it.id }) { f ->
                        FragmentCard(f, vm.setRepo)
                    }
                }
            }
        }
    }
}

private fun comparator(key: SortKey, desc: Boolean): Comparator<MemoryFragment> {
    val base = when (key) {
        SortKey.Slot   -> compareBy<MemoryFragment> { it.slotNum }
        SortKey.Rarity -> compareBy { -it.rarityNum }
        SortKey.Level  -> compareBy { -it.level }
        SortKey.Score  -> compareBy { -FragmentScorer.gearScore(it) }
        SortKey.Set    -> compareBy { it.setName }
    }
    return if (desc) base.reversed() else base
}

@Composable
private fun FilterBar(
    slot: Int?,
    rarity: Int?,
    sortKey: SortKey,
    sortDesc: Boolean,
    onSlotChange: (Int?) -> Unit,
    onRarityChange: (Int?) -> Unit,
    onSortKeyChange: (SortKey) -> Unit,
    onSortDirToggle: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 8.dp, vertical = 6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        // Slot filter chips
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("SLOT", color = ACCENT, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(54.dp))
            FilterChipPill(label = "All", active = slot == null) { onSlotChange(null) }
            for (n in 1..6) {
                FilterChipPill(label = romanNumeral(n), active = slot == n) { onSlotChange(n) }
            }
        }
        // Rarity filter chips + sort key chips on a separate row
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("RAR", color = ACCENT, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(54.dp))
            FilterChipPill(label = "All", active = rarity == null) { onRarityChange(null) }
            FilterChipPill(label = "Leg", active = rarity == 5, accent = GOLD) { onRarityChange(5) }
            FilterChipPill(label = "Epic", active = rarity == 4, accent = PURPLE) { onRarityChange(4) }
            FilterChipPill(label = "Rare", active = rarity == 3, accent = BLUE) { onRarityChange(3) }
        }
        // Sort row
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("SORT", color = ACCENT, fontSize = 9.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(54.dp))
            for (k in SortKey.values()) {
                FilterChipPill(label = k.name, active = sortKey == k) { onSortKeyChange(k) }
            }
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .background(BG_PANEL)
                    .border(1.dp, BORDER, RoundedCornerShape(6.dp))
                    .clickable { onSortDirToggle() }
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            ) {
                Text(if (sortDesc) "↓" else "↑", color = ACCENT, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun FilterChipPill(
    label: String,
    active: Boolean,
    accent: Color = ACCENT,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (active) accent.copy(alpha = 0.18f) else BG_PANEL)
            .border(1.dp, if (active) accent else BORDER, RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            label,
            color = if (active) accent else TEXT_DIM,
            fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
            fontSize = 10.sp
        )
    }
}

@Composable
private fun FragmentCard(f: MemoryFragment, setRepo: SetRepository) {
    val rarityColor = RARITY_COLOR[f.rarityNum] ?: TEXT_VERY_DIM
    val score = remember(f) { FragmentScorer.gearScore(f) }
    val grade = remember(score) { FragmentScorer.grade(score) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(BG_CARD)
            .border(1.dp, rarityColor.copy(alpha = 0.35f), RoundedCornerShape(10.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        // Header: piece icon + slot/set/rarity/level + score
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            PieceIcon(setName = f.setName, slotNum = f.slotNum, setRepo = setRepo)
            Column(modifier = Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(romanNumeral(f.slotNum), color = TEXT_DIM, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                    Text(
                        f.setName.ifBlank { "—" },
                        color = rarityColor,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines = 1
                    )
                    Text("+${f.level}", color = rarityColor, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
                }
                val main = f.statList.firstOrNull()
                if (main != null) {
                    Text(
                        "${main.stat}: ${formatStatValue(main)}",
                        color = Color.White,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 1
                    )
                }
                if (!f.equippedCharName.isNullOrBlank()) {
                    Text(
                        "Equipped: ${f.equippedCharName}",
                        color = TEXT_DIM,
                        fontSize = 9.sp,
                    )
                }
            }
            // Score badge
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    if (score > 0) "%.1f".format(score) else "—",
                    color = ACCENT,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold
                )
                if (grade != null) {
                    Text(
                        grade.label,
                        color = Color(grade.argbColor),
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold
                    )
                } else {
                    Text("GS", color = TEXT_VERY_DIM, fontSize = 9.sp)
                }
            }
        }

        // Substats — 4 lines, compact
        val subs = f.statList.drop(1)
        if (subs.isNotEmpty()) {
            Column(verticalArrangement = Arrangement.spacedBy(1.dp)) {
                for (s in subs) {
                    SubstatLine(s)
                }
            }
        }
    }
}

@Composable
private fun SubstatLine(s: StatEntry) {
    val eff = FragmentScorer.efficiency(s)
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        val rollMark = when {
            s.extraRolls >= 2 -> "» "
            s.extraRolls == 1 -> "› "
            else -> "  "
        }
        Text(
            rollMark + s.stat,
            color = TEXT_DIM,
            fontSize = 9.sp,
            modifier = Modifier.weight(1f),
            maxLines = 1
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
                modifier = Modifier.width(28.dp)
            )
        }
    }
}

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
            .size(36.dp)
            .clip(RoundedCornerShape(6.dp))
            .background(BG_PANEL)
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

private fun formatStatValue(s: StatEntry): String =
    if (s.type == "percent") "%.1f%%".format(s.value)
    else s.value.toInt().toString()

private fun efficiencyColor(pct: Double): Color = when {
    pct >= 93 -> GOLD
    pct >= 86 -> Color(0xFFFF9D00)
    pct >= 79 -> Color(0xFFFF6B6B)
    pct >= 70 -> ACCENT
    pct >= 61 -> Color(0xFF60A5FA)
    pct >= 53 -> Color(0xFF4ADE80)
    else      -> Color(0xFF9CA3AF)
}
