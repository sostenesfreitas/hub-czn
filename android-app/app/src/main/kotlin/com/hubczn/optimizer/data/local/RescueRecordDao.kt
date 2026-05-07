package com.hubczn.optimizer.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface RescueRecordDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun upsert(record: RescueRecordEntity)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun upsertAll(records: List<RescueRecordEntity>)

    @Query("SELECT * FROM rescue_records WHERE bannerName = :bannerName ORDER BY pullNumber DESC")
    suspend fun getByBanner(bannerName: String): List<RescueRecordEntity>

    @Query("SELECT * FROM rescue_records ORDER BY pullNumber ASC")
    suspend fun getAllOrderedByPullNumber(): List<RescueRecordEntity>

    @Query("""
        SELECT COUNT(*) FROM rescue_records
        WHERE bannerName = :bannerName AND name = :name AND type = :type
          AND createAt = :createAt AND rescueType = :rescueType AND isFeatured = :isFeatured
    """)
    suspend fun countDuplicates(
        bannerName: String, name: String, type: String,
        createAt: String, rescueType: String, isFeatured: Boolean
    ): Int

    @Query("""
        SELECT COUNT(*) FROM rescue_records
        WHERE bannerName = :bannerName AND name = :name AND type = :type
          AND createAt = :createAt AND rescueType = :rescueType AND isFeatured = :isFeatured
          AND duplicateIdx = :duplicateIdx
    """)
    suspend fun countWithDupIdx(
        bannerName: String, name: String, type: String,
        createAt: String, rescueType: String, isFeatured: Boolean,
        duplicateIdx: Int
    ): Int

    @Query("SELECT COALESCE(MAX(pullNumber), 0) FROM rescue_records")
    suspend fun maxPullNumber(): Long

    @Query("SELECT DISTINCT bannerName FROM rescue_records")
    suspend fun allBannerNames(): List<String>
}
