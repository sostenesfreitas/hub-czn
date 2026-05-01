import { useState, useEffect, useRef, useCallback } from 'react'
import type { CaptureLogMessage } from '@/lib/types'

export function useCaptureLog(port: number) {
  const [messages, setMessages] = useState<CaptureLogMessage[]>([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    let destroyed = false
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    function connect() {
      if (destroyed) return
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws/capture-log`)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)
      ws.onclose = () => {
        setConnected(false)
        if (!destroyed) retryTimer = setTimeout(connect, 2000)
      }
      ws.onerror = () => ws.close()
      ws.onmessage = (e) => {
        try {
          const msg: CaptureLogMessage = JSON.parse(e.data)
          setMessages(prev => [...prev.slice(-499), msg])
        } catch {
          // ignore malformed messages
        }
      }
    }

    connect()
    return () => {
      destroyed = true
      if (retryTimer !== null) clearTimeout(retryTimer)
      wsRef.current?.close()
    }
  }, [port])

  const clear = useCallback(() => setMessages([]), [])

  return { messages, connected, clear }
}
