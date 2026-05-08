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

    /**
     * Removes records that are duplicates by natural key
     * (bannerName, name, type, createAt, rescueType, isFeatured),
     * keeping only the lowest-id row per group. Returns the number of rows deleted.
     */
    @Query("""
        DELETE FROM rescue_records
        WHERE id NOT IN (
            SELECT MIN(id) FROM rescue_records
            GROUP BY bannerName, name, type, createAt, rescueType, isFeatured
        )
    """)
    suspend fun deleteDuplicatesByNaturalKey(): Int

    /** Reset all duplicateIdx values to 0 after cleanup. */
    @Query("UPDATE rescue_records SET duplicateIdx = 0")
    suspend fun resetDuplicateIdx()

    /**
     * Re-assign pullNumber per banner so that pullNumber=1 is the OLDEST
     * pull (lowest createAt) and pullNumber=N is the NEWEST. This restores
     * a consistent chronological order even after multiple partial scans
     * inserted records out of order.
     *
     * Uses a correlated COUNT subquery (O(N^2)) instead of ROW_NUMBER() OVER
     * because Room's SQL parser does not handle window functions reliably.
     */
    @Query("""
        UPDATE rescue_records
        SET pullNumber = 1 + (
            SELECT COUNT(*) FROM rescue_records AS other
            WHERE other.bannerName = rescue_records.bannerName
              AND (
                other.createAt < rescue_records.createAt
                OR (other.createAt = rescue_records.createAt AND other.duplicateIdx < rescue_records.duplicateIdx)
                OR (other.createAt = rescue_records.createAt AND other.duplicateIdx = rescue_records.duplicateIdx AND other.id < rescue_records.id)
              )
        )
    """)
    suspend fun renumberPullNumbersByCreateAt()

    /** Wipes the table — used by the "Import JSON" debug action. */
    @Query("DELETE FROM rescue_records")
    suspend fun deleteAll()
}
