import { useEffect, useRef } from 'react'

const API = import.meta.env.VITE_API_URL || '/api/v1'

/**
 * Subscribes to SSE events and calls the handler when events arrive.
 * Uses fetch + ReadableStream because EventSource doesn't support auth headers.
 */
export default function useRealtime(tokenProvider, onEvent) {
  const readerRef = useRef(null)
  const abortedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    abortedRef.current = false

    async function connect() {
      const token = await tokenProvider()
      if (!token) return

      const base = API.replace('/api/v1', '')
      const url = `${base}/api/v1/events/`

      try {
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (!response.ok || !response.body) return

        const reader = response.body.getReader()
        readerRef.current = reader
        const decoder = new TextDecoder()
        let buffer = ''

        while (!cancelled && !abortedRef.current) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          let eventType = ''
          let eventData = ''

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim()
            } else if (line.startsWith('data: ')) {
              eventData = line.slice(6).trim()
            } else if (line === '' && eventType && eventData) {
              try {
                onEvent(eventType, JSON.parse(eventData))
              } catch { /* ignore parse errors */ }
              eventType = ''
              eventData = ''
            }
          }
        }
      } catch { /* connection error */ }
    }

    connect()

    // Reconnect every 30s if disconnected
    const interval = setInterval(() => {
      if (!readerRef.current && !cancelled) connect()
    }, 30000)

    return () => {
      cancelled = true
      abortedRef.current = true
      clearInterval(interval)
      if (readerRef.current) readerRef.current.cancel()
    }
  }, [tokenProvider, onEvent])
}
