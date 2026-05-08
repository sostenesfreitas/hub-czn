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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import com.composables.icons.lucide.RefreshCw
import com.composables.icons.lucide.Sparkles
import com.hubczn.optimizer.data.local.ScanConfigStore
import com.hubczn.optimizer.data.repository.SetRepository
import com.hubczn.optimizer.logic.FinalStats
import com.hubczn.optimizer.logic.FragmentScorer
import com.hubczn.optimizer.logic.OptimizerEngine
import com.hubczn.optimizer.model.MemoryFragment
import com.hubczn.optimizer.ui.theme.CZNScannerTheme
import java.util.Locale

private val BG_PAGE = Color(0xFF0E0E0E)
private val BG_CARD = Color(0xFF181818)
private val BG_PANEL = Color(0xFF111827)
private val BORDER = Color(0xFF282828)
private val TEXT_DIM = Color(0xFF888888)
private val TEXT_VERY_DIM = Color(0xFF555555)
private val ACCENT = Color(0xFFC084FC)
private val GOLD = Color(0xFFFFD700)
private val PURPLE = Color(0xFFC084FC)
private val BLUE = Color(0xFF7C9FE8)

class OptimizerActivity : ComponentActivity() {

    private val viewModel: OptimizerViewModel by viewModels()

    override fun attachBaseContext(newBase: Context) {
        val lang = ScanConfigStore(newBase).languageOverride
        if (lang.isNullOrEmpty()) { super.attachBaseContext(newBase); return }
        val locale = Locale.forLanguageTag(lang)
        Locale.setDefault(locale)
        val cfg = Configuration(newBase.resources.configuration)
        cfg.setLocale(locale)
        super.attachBaseContext(newBase.createConfigurationContext(cfg))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { CZNScannerTheme { OptimizerScreen(viewModel) } }
    }
}

@Composable
private fun OptimizerScreen(vm: OptimizerViewModel) {
    val state by vm.state.collectAsStateWithLifecycle()

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
                Icon(Lucide.Sparkles, contentDescription = null, tint = ACCENT, modifier = Modifier.size(18.dp))
                Text("Optimizer", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(state.sourceFile ?: "—", color = TEXT_VERY_DIM, fontSize = 9.sp, maxLines = 1)
                Box(
                    modifier = Modifier
                        .clip(CircleShape)
                        .clickable { vm.reloadInventory() }
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
                Text(state.error!!, color = TEXT_DIM, fontSize = 12.sp)
            }
            state.fragments.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("No fragments captured yet.", color = Color(0xFF666666), fontSize = 13.sp)
            }
            else -> Body(state, vm)
        }
    }
}

@Composable
private fun Body(state: OptimizerViewModel.State, vm: OptimizerViewModel) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 10.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Combatant picker
        SectionHeader("Combatant")
        CombatantPicker(state.combatantName, vm.charRepo) { vm.selectCombatant(it) }

        if (state.combatantName == null) {
            Text("Pick a combatant to compute the recommended build.", color = TEXT_DIM, fontSize = 11.sp)
            return@Column
        }

        // Filters
        SectionHeader("Filters")
        FilterControls(state.filters) { vm.setFilters(it) }

        // 6 slot rows with candidates
        SectionHeader("Recommended Build")
        for (slot in 1..6) {
            val cands = state.candidates[slot].orEmpty()
            val picked = state.selection[slot]
            SlotPicker(
                slot = slot,
                candidates = cands,
                picked = picked,
                setRepo = vm.setRepo,
                onPick = { vm.selectFragmentForSlot(slot, it) },
            )
        }

        // Final stats
        if (state.finalStats != null) {
            SectionHeader("Final Stats")
            FinalStatsPanel(state.finalStats!!)
        }

        Spacer(Modifier.height(20.dp))
    }
}

@Composable
private fun SectionHeader(text: String) {
    Text(text, color = ACCENT, fontSize = 10.sp, fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(top = 4.dp))
}

@Composable
private fun CombatantPicker(
    selected: String?,
    charRepo: com.hubczn.optimizer.data.repository.CharacterRepository,
    onPick: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    val names = remember { charRepo.allNames().sorted() }
    Box(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(8.dp))
                .background(BG_CARD)
                .border(1.dp, BORDER, RoundedCornerShape(8.dp))
                .clickable { open = !open }
                .padding(horizontal = 12.dp, vertical = 10.dp)
        ) {
            Text(selected ?: "(pick a combatant)", color = if (selected == null) TEXT_DIM else Color.White, fontSize = 13.sp)
        }
        DropdownMenu(
            expanded = open,
            onDismissRequest = { open = false },
            modifier = Modifier
                .background(BG_CARD)
                .heightIn(max = 400.dp)
        ) {
            for (n in names) {
                DropdownMenuItem(
                    text = { Text(n, color = Color.White, fontSize = 12.sp) },
                    onClick = { onPick(n); open = false }
                )
            }
        }
    }
}

@Composable
private fun FilterControls(
    filters: OptimizerEngine.Filters,
    onChange: (OptimizerEngine.Filters) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Min rarity", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.width(80.dp))
            for ((label, n) in listOf("Leg" to 5, "Epic" to 4, "Rare" to 3, "Uncm" to 2)) {
                Chip(label, filters.minRarity == n) {
                    onChange(filters.copy(minRarity = n))
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Equipped", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.width(80.dp))
            Chip("Include", filters.includeEquipped) { onChange(filters.copy(includeEquipped = true)) }
            Chip("Exclude", !filters.includeEquipped) { onChange(filters.copy(includeEquipped = false)) }
        }
    }
}

@Composable
private fun Chip(label: String, active: Boolean, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(if (active) ACCENT.copy(alpha = 0.18f) else BG_PANEL)
            .border(1.dp, if (active) ACCENT else BORDER, RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(label, color = if (active) ACCENT else TEXT_DIM,
             fontSize = 10.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Normal)
    }
}

@Composable
private fun SlotPicker(
    slot: Int,
    candidates: List<MemoryFragment>,
    picked: MemoryFragment?,
    setRepo: SetRepository,
    onPick: (MemoryFragment?) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(BG_CARD)
            .border(1.dp, BORDER, RoundedCornerShape(8.dp))
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Slot ${roman(slot)}", color = ACCENT, fontWeight = FontWeight.Bold, fontSize = 11.sp)
            if (candidates.isEmpty()) {
                Text("(no candidates match filters)", color = TEXT_VERY_DIM, fontSize = 10.sp)
            } else {
                Text("${candidates.size} candidate${if (candidates.size == 1) "" else "s"}", color = TEXT_VERY_DIM, fontSize = 10.sp)
            }
        }
        for (frag in candidates) {
            CandidateRow(frag, isPicked = picked?.id == frag.id && picked.setName == frag.setName,
                setRepo = setRepo, onClick = { onPick(frag) })
        }
    }
}

@Composable
private fun CandidateRow(
    frag: MemoryFragment,
    isPicked: Boolean,
    setRepo: SetRepository,
    onClick: () -> Unit,
) {
    val rarityColor = when (frag.rarityNum) {
        5 -> GOLD; 4 -> PURPLE; 3 -> BLUE
        else -> TEXT_VERY_DIM
    }
    val score = remember(frag) { FragmentScorer.gearScore(frag) }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(if (isPicked) ACCENT.copy(alpha = 0.10f) else BG_PANEL)
            .border(1.dp, if (isPicked) ACCENT else BORDER, RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        PieceIcon(frag.setName, frag.slotNum, setRepo)
        Column(modifier = Modifier.weight(1f)) {
            Text(frag.setName.ifBlank { "—" }, color = rarityColor, fontWeight = FontWeight.SemiBold, fontSize = 11.sp, maxLines = 1)
            val main = frag.statList.firstOrNull()
            if (main != null) {
                val v = if (main.type == "percent") "%.1f%%".format(main.value) else main.value.toInt().toString()
                Text("${main.stat}: $v", color = Color.White, fontSize = 10.sp, maxLines = 1)
            }
            if (!frag.equippedCharName.isNullOrBlank()) {
                Text("Equipped: ${frag.equippedCharName}", color = TEXT_VERY_DIM, fontSize = 9.sp)
            }
        }
        Column(horizontalAlignment = Alignment.End) {
            Text("%.1f".format(score), color = ACCENT, fontWeight = FontWeight.Bold, fontSize = 12.sp)
            Text("+${frag.level}", color = rarityColor, fontSize = 9.sp)
        }
    }
}

@Composable
private fun FinalStatsPanel(stats: FinalStats) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(BG_CARD)
            .border(1.dp, BORDER, RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        Row { Text("ATK", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.weight(1f)); Text("%.0f".format(stats.attack), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
        Row { Text("DEF", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.weight(1f)); Text("%.0f".format(stats.defense), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
        Row { Text("HP", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.weight(1f)); Text("%.0f".format(stats.health), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
        Row { Text("CRate", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.weight(1f)); Text("%.1f%%".format(stats.critRate), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
        Row { Text("CDmg", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.weight(1f)); Text("%.1f%%".format(stats.critDmg), color = Color.White, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
        Row { Text("Avg DMG", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.weight(1f)); Text("%.0f".format(stats.avgDmg), color = ACCENT, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
        Row { Text("EHP", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.weight(1f)); Text("%.0f".format(stats.ehp), color = ACCENT, fontWeight = FontWeight.Bold, fontSize = 12.sp) }
        if (stats.ego > 0) Row { Text("Ego", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.weight(1f)); Text("%.0f".format(stats.ego), color = Color.White, fontSize = 11.sp) }
        if (stats.extraDmg > 0) Row { Text("Extra DMG%", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.weight(1f)); Text("%.1f%%".format(stats.extraDmg), color = Color.White, fontSize = 11.sp) }
        if (stats.dotDmg > 0) Row { Text("DoT%", color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.weight(1f)); Text("%.1f%%".format(stats.dotDmg), color = Color.White, fontSize = 11.sp) }
    }
}

@Composable
private fun PieceIcon(setName: String, slotNum: Int, setRepo: SetRepository) {
    val ctx = LocalContext.current
    val bmp = remember(setName, slotNum) {
        val path = setRepo.pieceAssetPath(setName, slotNum) ?: return@remember null
        runCatching { ctx.assets.open(path).use { BitmapFactory.decodeStream(it) } }.getOrNull()
    }
    Box(modifier = Modifier
        .size(32.dp)
        .clip(RoundedCornerShape(5.dp))
        .background(BG_PANEL)
    ) {
        if (bmp != null) {
            Image(bitmap = bmp.asImageBitmap(), contentDescription = null,
                modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Fit)
        }
    }
}

private fun roman(n: Int): String = when (n) {
    1 -> "I"; 2 -> "II"; 3 -> "III"; 4 -> "IV"; 5 -> "V"; 6 -> "VI"; else -> "$n"
}
