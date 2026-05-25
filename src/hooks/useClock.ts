import { useEffect, useState } from 'react'

export default function useClock() {
  const [dateTime, setDateTime] = useState(() => {
    const now = new Date()
    return now.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
  })

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = new Date()
      setDateTime(
        now.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',//Write failed — check PLC connection
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }),
      )
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  return dateTime
}
