package com.hubczn.optimizer.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [RescueRecordEntity::class], version = 1, exportSchema = false)
abstract class RescueRecordDatabase : RoomDatabase() {
    abstract fun rescueRecordDao(): RescueRecordDao

    companion object {
        @Volatile private var INSTANCE: RescueRecordDatabase? = null

        fun getInstance(context: Context): RescueRecordDatabase =
            INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    RescueRecordDatabase::class.java,
                    "rescue_records.db"
                ).build().also { INSTANCE = it }
            }
    }
}
