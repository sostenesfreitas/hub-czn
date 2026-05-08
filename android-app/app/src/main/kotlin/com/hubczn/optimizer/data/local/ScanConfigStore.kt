package com.hubczn.optimizer.data.local

import android.content.Context
import android.net.Uri

class ScanConfigStore(context: Context) {
    private val prefs = context.getSharedPreferences("czn_config", Context.MODE_PRIVATE)

    var calibRescueX: Float?
        get() = if (prefs.contains(KEY_CALIB_X_RESCUE)) prefs.getFloat(KEY_CALIB_X_RESCUE, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_X_RESCUE, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_X_RESCUE).apply()

    var calibRescueY: Float?
        get() = if (prefs.contains(KEY_CALIB_Y_RESCUE)) prefs.getFloat(KEY_CALIB_Y_RESCUE, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_Y_RESCUE, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_Y_RESCUE).apply()

    var calibFragmentsX: Float?
        get() = if (prefs.contains(KEY_CALIB_X_FRAG)) prefs.getFloat(KEY_CALIB_X_FRAG, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_X_FRAG, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_X_FRAG).apply()

    var calibFragmentsY: Float?
        get() = if (prefs.contains(KEY_CALIB_Y_FRAG)) prefs.getFloat(KEY_CALIB_Y_FRAG, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_Y_FRAG, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_Y_FRAG).apply()

    var calibCombatantsX: Float?
        get() = if (prefs.contains(KEY_CALIB_X_COMB)) prefs.getFloat(KEY_CALIB_X_COMB, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_X_COMB, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_X_COMB).apply()

    var calibCombatantsY: Float?
        get() = if (prefs.contains(KEY_CALIB_Y_COMB)) prefs.getFloat(KEY_CALIB_Y_COMB, 0f) else null
        set(v) = v?.let { prefs.edit().putFloat(KEY_CALIB_Y_COMB, it).apply() }
            ?: prefs.edit().remove(KEY_CALIB_Y_COMB).apply()

    var outputFolderUri: Uri?
        get() = prefs.getString(KEY_OUTPUT_URI, null)?.let { Uri.parse(it) }
        set(v) = v?.let { prefs.edit().putString(KEY_OUTPUT_URI, it.toString()).apply() }
            ?: prefs.edit().remove(KEY_OUTPUT_URI).apply()

    var languageOverride: String?
        get() = prefs.getString(KEY_LANGUAGE, null)
        set(v) = v?.let { prefs.edit().putString(KEY_LANGUAGE, it).apply() }
            ?: prefs.edit().remove(KEY_LANGUAGE).apply()

    var lastBannerIndex: Int
        get() = prefs.getInt(KEY_BANNER_IDX, 0)
        set(v) = prefs.edit().putInt(KEY_BANNER_IDX, v).apply()

    var overlayX: Int
        get() = prefs.getInt(KEY_OVERLAY_X, 0)
        set(v) = prefs.edit().putInt(KEY_OVERLAY_X, v).apply()

    var overlayY: Int
        get() = prefs.getInt(KEY_OVERLAY_Y, 200)
        set(v) = prefs.edit().putInt(KEY_OVERLAY_Y, v).apply()

    companion object {
        private const val KEY_CALIB_X_RESCUE = "calib_x_rescue"
        private const val KEY_CALIB_Y_RESCUE = "calib_y_rescue"
        private const val KEY_CALIB_X_FRAG = "calib_x_fragments"
        private const val KEY_CALIB_Y_FRAG = "calib_y_fragments"
        private const val KEY_CALIB_X_COMB = "calib_x_combatants"
        private const val KEY_CALIB_Y_COMB = "calib_y_combatants"
        private const val KEY_OUTPUT_URI = "output_folder_uri"
        private const val KEY_LANGUAGE = "language_override"
        private const val KEY_BANNER_IDX = "last_banner_index"
        private const val KEY_OVERLAY_X = "overlay_x"
        private const val KEY_OVERLAY_Y = "overlay_y"
    }
}
