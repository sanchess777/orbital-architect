import { useCallback, useEffect, useState } from 'react'
import Header from './components/Header'
import Landing from './components/Landing'
import RoomScreen from './components/RoomScreen'
import { LangProvider, useLang } from './i18n/LangContext'
import { createRoom, joinRoom, removePlayer } from './multiplayer/roomApi'
import {
  getActiveRoom,
  getPlayerId,
  getRoomFromUrl,
  getSavedName,
  saveName,
  setActiveRoom,
  setRoomInUrl,
} from './multiplayer/session'
import type { JoinError } from './types/game'

function AppInner() {
  const { t } = useLang()
  const [playerId] = useState(getPlayerId)
  const [code, setCode] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<JoinError | null>(null)
  // Після F5 у кімнаті повертаємось у неї автоматично
  const [booting, setBooting] = useState(() => {
    const urlCode = getRoomFromUrl()
    return urlCode !== '' && urlCode === getActiveRoom() && getSavedName() !== ''
  })

  const enterRoom = useCallback((roomCode: string) => {
    setActiveRoom(roomCode)
    setRoomInUrl(roomCode)
    setCode(roomCode)
  }, [])

  const exitRoom = useCallback(() => {
    setActiveRoom(null)
    setRoomInUrl(null)
    setCode(null)
  }, [])

  const leaveRoom = useCallback(() => {
    if (!code) return
    exitRoom()
    removePlayer(code, playerId).catch(() => undefined)
  }, [code, playerId, exitRoom])

  useEffect(() => {
    if (!booting) return
    let cancelled = false
    const roomCode = getRoomFromUrl()
    joinRoom(roomCode, playerId, getSavedName())
      .then((result) => {
        if (cancelled) return
        if (result.ok) enterRoom(roomCode)
        else setActiveRoom(null)
      })
      .catch(() => {
        if (!cancelled) setActiveRoom(null)
      })
      .finally(() => {
        if (!cancelled) setBooting(false)
      })
    return () => {
      cancelled = true
    }
  }, [booting, playerId, enterRoom])

  async function handleCreate(name: string) {
    setBusy(true)
    setError(null)
    try {
      saveName(name)
      enterRoom(await createRoom(playerId, name))
    } catch {
      setError('generic')
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(name: string, roomCode: string) {
    setBusy(true)
    setError(null)
    try {
      saveName(name)
      const result = await joinRoom(roomCode, playerId, name)
      if (result.ok) enterRoom(roomCode)
      else setError(result.reason)
    } catch {
      setError('generic')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header roomCode={code ?? undefined} onLeave={code ? leaveRoom : undefined} />
      {booting ? (
        <p className="p-8 text-center text-slate-400">{t.loading}</p>
      ) : code ? (
        <RoomScreen key={code} code={code} selfId={playerId} onRemoved={exitRoom} />
      ) : (
        <Landing
          initialName={getSavedName()}
          initialCode={getRoomFromUrl()}
          busy={busy}
          error={error}
          onCreate={handleCreate}
          onJoin={handleJoin}
        />
      )}
    </div>
  )
}

export default function App() {
  return (
    <LangProvider>
      <AppInner />
    </LangProvider>
  )
}