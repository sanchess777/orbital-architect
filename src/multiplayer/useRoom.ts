import { useEffect, useState } from 'react'
import { ref, onValue, update } from 'firebase/database'
import { db } from './firebase'

export function useRoom(code: string | null) {
  const [room, setRoom] = useState<Record<string, any> | null>(null)

  useEffect(() => {
    if (!code) return
    return onValue(ref(db, `rooms/${code}`), (snap) => setRoom(snap.val()))
  }, [code])

  const patch = (data: object) => {
    if (code) update(ref(db, `rooms/${code}`), data)
  }

  return { room, patch }
}