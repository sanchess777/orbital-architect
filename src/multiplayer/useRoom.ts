import { onValue, ref } from 'firebase/database'
import { useEffect, useMemo, useState } from 'react'
import { computeRoleOwners, resolveHostId, sortPlayers } from '../engine/roles'
import type { Player, RawRoom, RoomState } from '../types/game'
import { db } from './firebase'

export type RoomStatus = 'loading' | 'ready' | 'missing'

export function useRoom(code: string, selfId: string): { status: RoomStatus; room: RoomState | null } {
  // undefined = ще вантажиться, null = кімнати немає
  const [raw, setRaw] = useState<RawRoom | null | undefined>(undefined)

  useEffect(
    () =>
      onValue(ref(db, `rooms/${code}`), (snap) => {
        setRaw(snap.exists() ? (snap.val() as RawRoom) : null)
      }),
    [code],
  )

  const room = useMemo<RoomState | null>(() => {
    if (!raw) return null
    const players: Player[] = Object.entries(raw.players ?? {})
      .filter(([, p]) => typeof p.name === 'string')
      .map(([id, p]) => ({
        id,
        name: p.name,
        joinedAt: p.joinedAt ?? 0,
        // себе вважаємо онлайн одразу, не чекаючи запису з'єднання
        online: id === selfId || Object.keys(p.connections ?? {}).length > 0,
      }))
    const sorted = sortPlayers(players)
    return {
      code,
      hostId: resolveHostId(raw.hostId, sorted),
      seed: raw.seed ?? 0,
      counter: raw.counter ?? 0,
      players: sorted,
      roleOwners: computeRoleOwners(raw.hostId, sorted, raw.claims ?? {}),
    }
  }, [raw, code, selfId])

  const status: RoomStatus = raw === undefined ? 'loading' : raw === null ? 'missing' : 'ready'
  return { status, room }
}