package com.hubczn.optimizer.data.repository

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [33])
class CharacterRepositoryTest {
    private lateinit var repo: CharacterRepository

    @Before
    fun setUp() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        repo = CharacterRepository(ctx)
    }

    @Test
    fun `lookup returns null for unknown name`() {
        assertNull(repo.lookup("NonExistentCharXYZ"))
    }

    @Test
    fun `lookup returns data for known character`() {
        // characters.json must have at least one entry — any real name will do
        // This test validates the JSON loads and parses correctly
        val allNames = repo.allNames()
        assertTrue("characters.json should have entries", allNames.isNotEmpty())
        val firstName = allNames.first()
        val info = repo.lookup(firstName)
        assertNotNull(info)
        assertTrue(info!!.resId > 0)
        assertTrue(info.rarity in 3..5)
        assertTrue(info.kind in listOf("Combatant", "Partner"))
    }

    @Test
    fun `imageUrl is correct pattern`() {
        val allNames = repo.allNames()
        val info = repo.lookup(allNames.first())!!
        assertEquals(
            "/assets/game/faces/bookmark_face_character_map_${info.resId}.png",
            info.imageUrl
        )
    }
}
