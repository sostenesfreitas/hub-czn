package com.hubczn.optimizer.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hubczn.optimizer.model.CombatantStats
import com.hubczn.optimizer.model.MemoryFragment
import com.hubczn.optimizer.model.StatEntry

// ─── Theme tokens (mirrors CombatantsActivity) ─────────────────────────────
private val BG_CARD = Color(0xFF181818)
private val BG_PANEL = Color(0xFF141414)
private val BORDER = Color(0xFF282828)
private val TEXT_DIM = Color(0xFF888888)
private val TEXT_VERY_DIM = Color(0xFF555555)
private val ACCENT = Color(0xFFC084FC)

private val SET_NAMES = listOf(
    "Conqueror's Aspect", "Tetra's Authority", "Healer's Journey",
    "Black Wing", "Seth's Scarab", "Executioner's Tool",
    "Instinctual Growth", "Bullet of Order", "Offering of the Void",
    "Spark of Passion", "Cursed Corpse", "Line of Justice",
    "Wireth's Steel", "Orb of Inhibition", "Judgment's Flames",
    "Beast's Yearning", "Glory's Reign", "Prelude to a Hero",
    "Starlight and Dreams",
)

private val RARITY_OPTIONS = listOf(
    "Legendary" to 5,
    "Epic" to 4,
    "Rare" to 3,
    "Uncommon" to 2,
)

private val STAT_NAME_OPTIONS = listOf(
    "Attack", "Defense", "Health",
    "Critical Chance", "Critical Damage",
    "Extra Damage", "Damage over time",
    "Ego Recovery",
    "Passion Damage", "Order Damage", "Justice Damage",
    "Void Damage", "Instinct Damage",
)

// ─── Stats edit dialog ─────────────────────────────────────────────────────

@Composable
fun StatsEditDialog(
    combatantName: String,
    current: CombatantStats,
    onSave: (CombatantStats) -> Unit,
    onDismiss: () -> Unit,
) {
    var attack by remember { mutableStateOf(current.attack.toInt().toString()) }
    var defense by remember { mutableStateOf(current.defense.toInt().toString()) }
    var health by remember { mutableStateOf(current.health.toInt().toString()) }
    var crate by remember { mutableStateOf("%.1f".format(current.criticalChance)) }
    var cdmg by remember { mutableStateOf("%.1f".format(current.criticalDamage)) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BG_CARD,
        title = {
            Text("Edit Stats — $combatantName", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                NumField("Attack",          attack) { attack = it }
                NumField("Defense",         defense) { defense = it }
                NumField("Health",          health) { health = it }
                NumField("Critical Chance %", crate, allowDecimal = true) { crate = it }
                NumField("Critical Damage %", cdmg,  allowDecimal = true) { cdmg = it }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                onSave(
                    CombatantStats(
                        attack = attack.toDoubleOrNull() ?: current.attack,
                        defense = defense.toDoubleOrNull() ?: current.defense,
                        health = health.toDoubleOrNull() ?: current.health,
                        criticalChance = crate.toDoubleOrNull() ?: current.criticalChance,
                        criticalDamage = cdmg.toDoubleOrNull() ?: current.criticalDamage,
                    )
                )
            }) {
                Text("Save", color = ACCENT, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = TEXT_DIM) }
        }
    )
}

// ─── Fragment edit dialog ──────────────────────────────────────────────────

@Composable
fun FragmentEditDialog(
    combatantName: String,
    slotNum: Int,
    current: MemoryFragment?,
    onSave: (MemoryFragment) -> Unit,
    onClear: () -> Unit,
    onDismiss: () -> Unit,
) {
    val seed = current ?: MemoryFragment(
        id = 0, slotNum = slotNum, setName = "", rarity = "Legendary", rarityNum = 5,
        level = 5, locked = false, equippedCharName = combatantName,
        statList = (0..4).map { StatEntry(it, "", "flat", 0.0, 0) },
    )

    var setName by remember { mutableStateOf(seed.setName) }
    var rarityIdx by remember {
        mutableStateOf(RARITY_OPTIONS.indexOfFirst { it.first == seed.rarity }
            .takeIf { it >= 0 } ?: 0)
    }
    var levelText by remember { mutableStateOf(seed.level.toString()) }
    val statList = remember(seed) {
        mutableStateListOf<StatEntry>().apply {
            for (i in 0..4) {
                add(seed.statList.getOrNull(i)
                    ?: StatEntry(i, "", "flat", 0.0, 0))
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = BG_CARD,
        title = {
            Text(
                "Edit Slot ${romanI(slotNum)} — $combatantName",
                color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 480.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                // Set name dropdown
                LabelRow("Set") {
                    DropdownText(
                        value = setName.ifBlank { "(none)" },
                        options = listOf("(none)") + SET_NAMES,
                        onPick = { setName = if (it == "(none)") "" else it }
                    )
                }
                // Rarity dropdown
                LabelRow("Rarity") {
                    DropdownText(
                        value = RARITY_OPTIONS[rarityIdx].first,
                        options = RARITY_OPTIONS.map { it.first },
                        onPick = { picked ->
                            rarityIdx = RARITY_OPTIONS.indexOfFirst { it.first == picked }
                                .takeIf { it >= 0 } ?: 0
                        }
                    )
                }
                // Level
                LabelRow("Level (+N)") {
                    NumField("", levelText) { levelText = it }
                }

                Text("Main stat", color = ACCENT, fontSize = 10.sp,
                    modifier = Modifier.padding(top = 4.dp))
                StatRow(statList[0]) { statList[0] = it }

                Text("Substats", color = ACCENT, fontSize = 10.sp,
                    modifier = Modifier.padding(top = 4.dp))
                for (i in 1..4) {
                    StatRow(statList[i]) { statList[i] = it }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val rarityPair = RARITY_OPTIONS[rarityIdx]
                onSave(
                    seed.copy(
                        setName = setName,
                        rarity = rarityPair.first,
                        rarityNum = rarityPair.second,
                        level = levelText.toIntOrNull() ?: seed.level,
                        statList = statList.toList().mapIndexed { i, s -> s.copy(slot = i) },
                    )
                )
            }) {
                Text("Save", color = ACCENT, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            Row {
                TextButton(onClick = onClear) {
                    Text("Clear", color = Color(0xFFFF6B6B))
                }
                TextButton(onClick = onDismiss) {
                    Text("Cancel", color = TEXT_DIM)
                }
            }
        }
    )
}

// ─── Helpers ───────────────────────────────────────────────────────────────

@Composable
private fun NumField(
    label: String,
    value: String,
    allowDecimal: Boolean = false,
    onChange: (String) -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { v ->
            // Filter to digits + optional single dot.
            val keep = v.filterIndexed { i, c ->
                c.isDigit() || (allowDecimal && c == '.' && v.indexOf('.') == i)
            }
            onChange(keep)
        },
        label = if (label.isNotEmpty()) { @Composable { Text(label, color = TEXT_DIM, fontSize = 11.sp) } } else null,
        singleLine = true,
        keyboardOptions = KeyboardOptions(
            keyboardType = if (allowDecimal) KeyboardType.Decimal else KeyboardType.Number
        ),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = ACCENT,
            unfocusedBorderColor = BORDER,
            focusedTextColor = Color.White,
            unfocusedTextColor = Color.White,
            cursorColor = ACCENT,
        ),
        modifier = Modifier.fillMaxWidth()
    )
}

@Composable
private fun LabelRow(label: String, content: @Composable RowScope.() -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = TEXT_DIM, fontSize = 11.sp, modifier = Modifier.width(90.dp))
        content()
    }
}

@Composable
private fun DropdownText(
    value: String,
    options: List<String>,
    onPick: (String) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box(modifier = Modifier.fillMaxWidth()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(6.dp))
                .background(BG_PANEL)
                .border(1.dp, BORDER, RoundedCornerShape(6.dp))
                .clickable { open = !open }
                .padding(horizontal = 10.dp, vertical = 8.dp)
        ) {
            Text(value, color = Color.White, fontSize = 12.sp)
        }
        DropdownMenu(
            expanded = open,
            onDismissRequest = { open = false },
            modifier = Modifier.background(BG_CARD)
        ) {
            for (o in options) {
                DropdownMenuItem(
                    text = { Text(o, color = Color.White, fontSize = 12.sp) },
                    onClick = { onPick(o); open = false }
                )
            }
        }
    }
}

@Composable
private fun StatRow(
    entry: StatEntry,
    onChange: (StatEntry) -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(BG_PANEL, RoundedCornerShape(6.dp))
            .border(1.dp, BORDER, RoundedCornerShape(6.dp))
            .padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(modifier = Modifier.weight(1f)) {
                DropdownText(
                    value = entry.stat.ifBlank { "(stat)" },
                    options = listOf("") + STAT_NAME_OPTIONS,
                    onPick = { onChange(entry.copy(stat = it)) }
                )
            }
            Box(modifier = Modifier.width(80.dp)) {
                DropdownText(
                    value = entry.type,
                    options = listOf("flat", "percent"),
                    onPick = { onChange(entry.copy(type = it)) }
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            var valueText by remember(entry.value) {
                mutableStateOf(if (entry.type == "percent") "%.1f".format(entry.value) else entry.value.toInt().toString())
            }
            Box(modifier = Modifier.weight(1f)) {
                NumField("Value", valueText, allowDecimal = true) {
                    valueText = it
                    onChange(entry.copy(value = it.toDoubleOrNull() ?: 0.0))
                }
            }
            Box(modifier = Modifier.width(80.dp)) {
                var rollsText by remember(entry.extraRolls) { mutableStateOf(entry.extraRolls.toString()) }
                NumField("Rolls", rollsText) {
                    rollsText = it
                    onChange(entry.copy(extraRolls = it.toIntOrNull() ?: 0))
                }
            }
        }
    }
}

private fun romanI(n: Int): String = when (n) {
    1 -> "I"; 2 -> "II"; 3 -> "III"; 4 -> "IV"; 5 -> "V"; 6 -> "VI"; else -> "$n"
}
