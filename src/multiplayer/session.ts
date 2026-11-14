const ID_KEY = 'oa.playerId'
const NAME_KEY = 'oa.name'
const ROOM_KEY = 'oa.room'

export const CODE_LENGTH = 5

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function read(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

function write(storage: Storage, key: string, value: string | null) {
  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
  } catch {
    // приватний режим тощо: ігноруємо
  }
}

/** Свій ID у кожній вкладці (sessionStorage): так 4 вкладки = 4 різні гравці */
export function getPlayerId(): string {
  let id = read(sessionStorage, ID_KEY)
  if (!id) {
    id = crypto.randomUUID().slice(0, 12)
    write(sessionStorage, ID_KEY, id)
  }
  return id
}

export function getSavedName(): string {
  return read(localStorage, NAME_KEY) ?? ''
}

export function saveName(name: string) {
  write(localStorage, NAME_KEY, name)
}

/** Кімната, в якій ця вкладка зараз сидить: щоб після F5 повернутися автоматично */
export function getActiveRoom(): string | null {
  return read(sessionStorage, ROOM_KEY)
}

export function setActiveRoom(code: string | null) {
  write(sessionStorage, ROOM_KEY, code)
}

export function getRoomFromUrl(): string {
  return normalizeCode(new URLSearchParams(window.location.search).get('room') ?? '')
}

export function setRoomInUrl(code: string | null) {
  const url = new URL(window.location.href)
  if (code) url.searchParams.set('room', code)
  else url.searchParams.delete('room')
  window.history.replaceState(null, '', url)
}

export function inviteLink(code: string): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('room', code)
  return url.toString()
}