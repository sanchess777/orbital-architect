import { onValue, ref } from 'firebase/database'
import { useEffect, useState } from 'react'
import { createDefaultConfig } from '../engine/catalog'
import { computeRoleOwners, resolveHostId, sortPlayers } from '../engine/roles'
import type { MissionConfig, Player, RawRoom, RoomState } from '../types/game'
import { db } from './firebase'

export type RoomStatus = 'loading' | 'ready' | 'missing'

export interface UseRoomResult {
  status: RoomStatus
  room: RoomState | null
}

interface SnapshotState {
  forCode: string
  status: Exclude<RoomStatus, 'loading'>
  room: RoomState | null
}

export function useRoom(code: string, selfId?: string): UseRoomResult {
  const [snapshot, setSnapshot] = useState<SnapshotState | null>(null)

  useEffect(() => {
    const roomRef = ref(db, `rooms/${code}`)

    const unsubscribe = onValue(
      roomRef,
      (snap) => {
        if (!snap.exists()) {
          setSnapshot({ forCode: code, status: 'missing', room: null })
          return
        }

        const raw = snap.val() as RawRoom
        const rawPlayers: Player[] = Object.entries(raw.players ?? {}).map(([id, p]) => ({
          id,
          name: p.name,
          joinedAt: p.joinedAt,
          online:
            id === selfId ||
            Boolean(p.connections && Object.keys(p.connections).length > 0),
        }))

        const players = sortPlayers(rawPlayers)
        const hostId = resolveHostId(raw.hostId, players)
        const roleOwners = computeRoleOwners(raw.hostId, players, raw.claims ?? {})

        const defaultCfg = createDefaultConfig(raw.config?.targetId ?? 'leo')
        const config: MissionConfig = raw.config
          ? {
              ...defaultCfg,
              ...raw.config,
              // Firebase видаляє порожні масиви, тому гарантуємо валідний string[]
              instrumentIds: raw.config.instrumentIds ?? [],
            }
          : defaultCfg

        const room: RoomState = {
          code,
          hostId,
          seed: raw.seed,
          counter: raw.counter ?? 0,
          players,
          roleOwners,
          phase: raw.phase ?? 'lobby',
          attempt: raw.attempt ?? 1,
          config,
          readyRoles: {
            science: Boolean(raw.readyRoles?.science),
            bus: Boolean(raw.readyRoles?.bus),
            flight: Boolean(raw.readyRoles?.flight),
            comms: Boolean(raw.readyRoles?.comms),
          },
        }

        setSnapshot({ forCode: code, status: 'ready', room })
      },
      () => {
        setSnapshot({ forCode: code, status: 'missing', room: null })
      },
    )

    return () => {
      unsubscribe()
    }
  }, [code, selfId])

  if (!snapshot || snapshot.forCode !== code) {
    return { status: 'loading', room: null }
  }

  return { status: snapshot.status, room: snapshot.room }
}