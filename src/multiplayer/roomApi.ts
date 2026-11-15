import {
  onDisconnect,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set,
  update,
  type DatabaseReference,
} from 'firebase/database'
import { createDefaultConfig } from '../engine/catalog'
import { MAX_PLAYERS, ROLES } from '../engine/roles'
import type { MissionConfig, PlayerRole, RawRoom, TargetId } from '../types/game'
import { db } from './firebase'
import { CODE_LENGTH } from './session'

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const GHOST_GRACE_MS = 15000

const roomRef = (code: string) => ref(db, `rooms/${code}`)

function generateCode(): string {
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length))
  }
  return code
}

export async function createRoom(playerId: string, name: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode()
    const now = Date.now()
    const result = await runTransaction(roomRef(code), (current: RawRoom | null) => {
      if (current !== null) return undefined
      const room: RawRoom = {
        hostId: playerId,
        seed: Math.floor(Math.random() * 2147483647),
        counter: 0,
        createdAt: now,
        players: { [playerId]: { name, joinedAt: now } },
        phase: 'lobby',
        attempt: 1,
        config: createDefaultConfig('leo'),
        readyRoles: { science: false, bus: false, flight: false, comms: false },
      }
      return room
    })
    if (result.committed) return code
  }
  throw new Error('create-failed')
}

export type JoinResult = { ok: true } | { ok: false; reason: 'notFound' | 'full' }

export async function joinRoom(code: string, playerId: string, name: string): Promise<JoinResult> {
  const flags = { full: false }

  const result = await runTransaction(roomRef(code), (room: RawRoom | null) => {
    if (room === null) return room

    const players = { ...(room.players ?? {}) }
    if (players[playerId]) return room

    const now = Date.now()
    const ghosts = Object.entries(players)
      .filter(([, p]) => !p.connections && now - p.joinedAt > GHOST_GRACE_MS)
      .sort(([, a], [, b]) => a.joinedAt - b.joinedAt)

    while (Object.keys(players).length >= MAX_PLAYERS && ghosts.length > 0) {
      const ghost = ghosts.shift()
      if (ghost) delete players[ghost[0]]
    }
    if (Object.keys(players).length >= MAX_PLAYERS) {
      flags.full = true
      return undefined
    }

    players[playerId] = { name, joinedAt: now }
    return { ...room, players }
  })

  const data = result.snapshot.val() as RawRoom | null
  if (data?.players?.[playerId]) return { ok: true }
  return { ok: false, reason: flags.full ? 'full' : 'notFound' }
}

export async function removePlayer(code: string, playerId: string): Promise<void> {
  await runTransaction(roomRef(code), (room: RawRoom | null) => {
    if (room === null) return room

    const players = { ...(room.players ?? {}) }
    delete players[playerId]
    if (Object.keys(players).length === 0) return null

    const claims = { ...(room.claims ?? {}) }
    for (const role of ROLES) {
      if (claims[role] === playerId) delete claims[role]
    }

    const oldest = Object.entries(players).sort(([, a], [, b]) => a.joinedAt - b.joinedAt)[0]
    const hostId = room.hostId === playerId && oldest ? oldest[0] : room.hostId

    return { ...room, hostId, players, claims }
  })
}

export async function claimRole(
  code: string,
  role: PlayerRole,
  playerId: string,
  presentIds: Set<string>,
): Promise<boolean> {
  const result = await runTransaction(
    ref(db, `rooms/${code}/claims/${role}`),
    (current: string | null) => {
      if (current && current !== playerId && presentIds.has(current)) return undefined
      return playerId
    },
  )
  return result.committed
}

export function releaseRole(code: string, role: PlayerRole): Promise<void> {
  return remove(ref(db, `rooms/${code}/claims/${role}`))
}

export async function incrementCounter(code: string): Promise<void> {
  await runTransaction(ref(db, `rooms/${code}/counter`), (c: number | null) => (c ?? 0) + 1)
}

export function attachPresence(code: string, playerId: string): () => void {
  let connRef: DatabaseReference | null = null

  const stop = onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() !== true) return
    const conn = push(ref(db, `rooms/${code}/players/${playerId}/connections`))
    connRef = conn
    onDisconnect(conn).remove()
    set(conn, true)
  })

  return () => {
    stop()
    if (connRef) remove(connRef)
  }
}

export async function startMissionDesign(code: string, targetId: TargetId): Promise<void> {
  await update(roomRef(code), {
    phase: 'design',
    attempt: 1,
    config: createDefaultConfig(targetId),
    readyRoles: { science: false, bus: false, flight: false, comms: false },
  })
}

export async function returnToLobby(code: string): Promise<void> {
  await update(roomRef(code), {
    phase: 'lobby',
    readyRoles: { science: false, bus: false, flight: false, comms: false },
  })
}

export async function updateMissionConfig(
  code: string,
  patch: Partial<MissionConfig>,
): Promise<void> {
  await runTransaction(ref(db, `rooms/${code}`), (room: RawRoom | null) => {
    if (!room) return room
    const baseConfig = room.config ?? createDefaultConfig('leo')
    return {
      ...room,
      config: { ...baseConfig, ...patch },
      readyRoles: { science: false, bus: false, flight: false, comms: false },
    }
  })
}

export async function setRoleReady(
  code: string,
  role: PlayerRole,
  ready: boolean,
): Promise<void> {
  await set(ref(db, `rooms/${code}/readyRoles/${role}`), ready)
}

export async function launchMission(code: string): Promise<void> {
  await set(ref(db, `rooms/${code}/phase`), 'report')
}

export async function returnToDesign(code: string): Promise<void> {
  await runTransaction(roomRef(code), (room: RawRoom | null) => {
    if (!room) return room
    return {
      ...room,
      phase: 'design',
      attempt: (room.attempt ?? 1) + 1,
      readyRoles: { science: false, bus: false, flight: false, comms: false },
    }
  })
}