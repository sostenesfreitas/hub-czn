package com.hubczn.optimizer.ui

import android.content.Intent
import android.graphics.BitmapFactory
import android.net.Uri
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
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
import com.hubczn.optimizer.data.local.RescueRecordDatabase
import com.hubczn.optimizer.data.local.RescueRecordEntity
import com.hubczn.optimizer.data.repository.JSONExporter
import com.hubczn.optimizer.data.local.ScanConfigStore
import com.hubczn.optimizer.ui.theme.CZNScannerTheme
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

class HistoryActivity : ComponentActivity() {
    private val viewModel: HistoryViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            CZNScannerTheme {
                HistoryScreen(viewModel)
            }
        }
    }
}

@Composable
private fun HistoryScreen(viewModel: HistoryViewModel) {
    val context = LocalContext.current
    val allRecords by viewModel.records.collectAsStateWithLifecycle()
    val selectedBannerIdx by viewModel.selectedBannerIdx.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    var filterRarity by remember { mutableStateOf(0) } // 0=All, 5=5★, 4=4★

    val bannerRecords = viewModel.recordsForBanner(selectedBannerIdx)
    val stats = remember(bannerRecords) { HistoryViewModel.computeStats(bannerRecords) }
    val fiveStars = remember(bannerRecords) { HistoryViewModel.fiveStarRecords(bannerRecords) }
    val filtered = remember(bannerRecords, filterRarity) {
        if (filterRarity == 0) bannerRecords.sortedByDescending { it.pullNumber }
        else bannerRecords.filter { it.rarity == filterRarity }.sortedByDescending { it.pullNumber }
    }

    Box(modifier = Modifier.fillMaxSize().background(Color(0xFF0D0D1A))) {
        Column(modifier = Modifier.fillMaxSize()) {

            // Top bar
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF16213E))
                    .padding(start = 14.dp, end = 14.dp, top = 14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("Rescue Records", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        ActionChip(
                            label = "⬇ Export JSON",
                            color = Color(0xFFE87A2D)
                        ) {
                            scope.launch {
                                val db = RescueRecordDatabase.getInstance(context)
                                val store = ScanConfigStore(context)
                                val exporter = JSONExporter(context, db.rescueRecordDao(), store.outputFolderUri)
                                exporter.exportRescueRecordsFromDb()
                            }
                        }
                        ActionChip(
                            label = "☁ Save to Cloud",
                            color = Color(0xFF7C9FE8)
                        ) {
                            context.startActivity(
                                Intent(Intent.ACTION_VIEW, Uri.parse("https://hub-czn.lovable.app"))
                            )
                        }
                    }
                }

                // Banner tabs
                Row(modifier = Modifier.fillMaxWidth()) {
                    viewModel.bannerNames.forEachIndexed { idx, name ->
                        val shortName = when (idx) {
                            0 -> "Seasonal Combatant"
                            1 -> "Gacha General"
                            else -> "Pickup Supporter"
                        }
                        val active = idx == selectedBannerIdx
                        Column(
                            modifier = Modifier
                                .clickable { viewModel.selectBanner(idx) }
                                .padding(horizontal = 10.dp, vertical = 8.dp)
                        ) {
                            Text(
                                shortName,
                                color = if (active) Color(0xFFE87A2D) else Color(0xFF666666),
                                fontSize = 11.sp,
                                fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal
                            )
                            if (active) {
                                Spacer(Modifier.height(3.dp))
                                Box(Modifier.height(2.dp).fillMaxWidth().background(Color(0xFFE87A2D)))
                            }
                        }
                    }
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(10.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {

                // Stats card
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF1A1A2E), RoundedCornerShape(12.dp))
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(verticalArrangement = Arrangement.spacedBy(5.dp), modifier = Modifier.weight(1f)) {
                            StatRow("Total Pulls", "${stats.total}", Color.White)
                            StatRow("Resources Spent", "${stats.resourcesSpent}", Color(0xFFE87A2D))
                            StatRow("5★ Pulls", "${stats.fiveStar}", Color(0xFFFFD700))
                            StatRow("4★ Pulls", "${stats.fourStar}", Color(0xFFB39DDB))
                            StatRow("Avg 5★ Pity", "${"%.1f".format(stats.avgPity5)}", Color.White)
                            StatRow("Avg 4★ Pity", "${"%.1f".format(stats.avgPity4)}", Color.White)
                        }
                        DonutChart(
                            fiveStar = stats.fiveStar,
                            fourStar = stats.fourStar,
                            total = stats.total,
                            modifier = Modifier.size(70.dp)
                        )
                    }
                }

                // 5★ portrait grid
                if (fiveStars.isNotEmpty()) {
                    item {
                        SectionLabel("Recent 5★ Pulls")
                    }
                    item {
                        LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            items(fiveStars) { r ->
                                PortraitTile(r, size = 52)
                            }
                        }
                    }
                }

                // Filter row
                item {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        SectionLabel("Full History")
                        Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                            FilterChip("All", filterRarity == 0) { filterRarity = 0 }
                            FilterChip("5★", filterRarity == 5) { filterRarity = 5 }
                            FilterChip("4★", filterRarity == 4) { filterRarity = 4 }
                        }
                    }
                }

                // Pull list
                items(filtered, key = { it.id }) { r ->
                    PullRow(r)
                }
            }
        }
    }
}

@Composable
private fun StatRow(label: String, value: String, valueColor: Color) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = Color(0xFF888888), fontSize = 10.sp)
        Text(value, color = valueColor, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun DonutChart(fiveStar: Int, fourStar: Int, total: Int, modifier: Modifier) {
    Box(
        modifier = modifier.background(Color(0xFF2a2a4a), RoundedCornerShape(50)),
        contentAlignment = Alignment.Center
    ) {
        Text(
            if (total > 0) "${"%.0f".format(fiveStar * 100f / total)}%"
            else "0%",
            color = Color(0xFFFFD700), fontSize = 11.sp, fontWeight = FontWeight.Bold
        )
    }
}

@Composable
private fun PortraitTile(record: RescueRecordEntity, size: Int) {
    val context = LocalContext.current
    val bitmap = remember(record.resId) {
        runCatching {
            context.assets.open("faces/bookmark_face_character_map_${record.resId}.png")
                .use { BitmapFactory.decodeStream(it) }
        }.getOrNull()
    }

    Box(modifier = Modifier.size(size.dp)) {
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = record.name,
                modifier = Modifier.fillMaxSize().clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Crop
            )
        } else {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Color(0xFF1A1A2E), RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text("?", color = Color(0xFF555555), fontSize = 18.sp)
            }
        }
        Box(
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .background(Color(0xCCE87A2D), RoundedCornerShape(topStart = 4.dp))
                .padding(horizontal = 3.dp, vertical = 1.dp)
        ) {
            Text("${record.duplicateIdx + 1}", color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun PullRow(record: RescueRecordEntity) {
    val borderColor = when (record.rarity) {
        5 -> Color(0xFFFFD700)
        4 -> Color(0xFFB39DDB)
        else -> Color.Transparent
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color(0xFF1A1A2E), RoundedCornerShape(8.dp))
            .border(
                width = if (record.rarity != null && record.rarity >= 4) 2.dp else 0.dp,
                color = borderColor,
                shape = RoundedCornerShape(topStart = 8.dp, bottomStart = 8.dp)
            )
            .padding(horizontal = 10.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        Text(
            "${record.pullNumber}",
            color = Color(0xFF555555), fontSize = 10.sp,
            modifier = Modifier.width(40.dp)
        )

        val context = LocalContext.current
        val bitmap = remember(record.resId) {
            runCatching {
                context.assets.open("faces/bookmark_face_character_map_${record.resId}.png")
                    .use { BitmapFactory.decodeStream(it) }
            }.getOrNull()
        }
        Box(modifier = Modifier.size(28.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFF111827))) {
            if (bitmap != null) {
                Image(bitmap.asImageBitmap(), record.name, modifier = Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            }
        }

        Column(modifier = Modifier.weight(1f)) {
            Text(record.name, color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            val kindColor = if (record.type.startsWith("Partner")) Color(0xFF66BB6A) else Color(0xFFEF9A9A)
            val kindBg = if (record.type.startsWith("Partner")) Color(0xFF1A2A1A) else Color(0xFF2A1A1A)
            Text(
                record.type.removeSuffix("s"),
                color = kindColor, fontSize = 9.sp,
                modifier = Modifier
                    .background(kindBg, RoundedCornerShape(3.dp))
                    .padding(horizontal = 5.dp, vertical = 1.dp)
            )
        }

        val pityColor = if (record.rarity == 5) Color(0xFFFFD700) else Color(0xFFE87A2D)
        Text(
            "${record.duplicateIdx + 1}",
            color = pityColor, fontSize = 11.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.width(24.dp)
        )

        val dateStr = remember(record.createAt) {
            runCatching {
                val sdf = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.getDefault())
                val out = SimpleDateFormat("M/d HH:mm", Locale.getDefault())
                out.format(sdf.parse(record.createAt)!!)
            }.getOrDefault(record.createAt.take(10))
        }
        Text(dateStr, color = Color(0xFF555555), fontSize = 9.sp)
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(text, color = Color(0xFFE87A2D), fontSize = 10.sp, letterSpacing = 1.sp)
}

@Composable
private fun FilterChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        label,
        color = if (selected) Color(0xFFE87A2D) else Color(0xFF888888),
        fontSize = 10.sp,
        modifier = Modifier
            .background(
                if (selected) Color(0xFF1F1508) else Color(0xFF1A1A2E),
                RoundedCornerShape(10.dp)
            )
            .border(1.dp, if (selected) Color(0x55E87A2D) else Color(0xFF2a2a4a), RoundedCornerShape(10.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 4.dp)
    )
}

@Composable
private fun ActionChip(label: String, color: Color, onClick: () -> Unit) {
    Text(
        label,
        color = color,
        fontSize = 9.sp,
        modifier = Modifier
            .background(color.copy(alpha = 0.1f), RoundedCornerShape(6.dp))
            .border(1.dp, color.copy(alpha = 0.3f), RoundedCornerShape(6.dp))
            .clickable { onClick() }
            .padding(horizontal = 8.dp, vertical = 4.dp)
    )
}
