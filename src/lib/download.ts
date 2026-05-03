import { save } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'

export async function downloadJson(filename: string, data: unknown): Promise<void> {
  const path = await save({
    defaultPath: filename,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!path) return
  await writeTextFile(path, JSON.stringify(data, null, 2))
}
