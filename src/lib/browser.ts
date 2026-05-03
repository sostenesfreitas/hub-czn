export async function openExternal(url: string): Promise<void> {
  // shell.open is most reliable on Windows (cmd /c start <url>)
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
    return
  } catch (e1) {
    console.warn('[browser] shell.open failed:', e1)
  }

  // opener plugin fallback
  try {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
    return
  } catch (e2) {
    console.warn('[browser] opener.openUrl failed:', e2)
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
