import type { LocalizedText, Player, PlayerRole } from '../types/game'

export const MAX_PLAYERS = 4
export const ROLES: PlayerRole[] = ['science', 'bus', 'flight', 'comms']

export interface RoleInfo {
  name: LocalizedText
  segment: LocalizedText
  description: LocalizedText
}

export const ROLE_INFO: Record<PlayerRole, RoleInfo> = {
  science: {
    name: { en: 'Science Lead', uk: 'Науковий керівник' },
    segment: { en: 'User Segment', uk: 'Сегмент користувачів' },
    description: {
      en: 'Chooses the mission goal and the scientific instruments.',
      uk: 'Обирає мету місії та наукові прилади.',
    },
  },
  bus: {
    name: { en: 'Spacecraft Engineer', uk: 'Інженер апарата' },
    segment: { en: 'Space Segment', uk: 'Космічний сегмент' },
    description: {
      en: 'Designs the spacecraft body, solar panels, batteries and attitude control.',
      uk: 'Проєктує корпус апарата, сонячні панелі, батареї та систему орієнтації.',
    },
  },
  flight: {
    name: { en: 'Flight Dynamics', uk: 'Балістик' },
    segment: { en: 'Launch Segment', uk: 'Сегмент запуску' },
    description: {
      en: 'Picks the orbit and the launch vehicle and watches the mass limit.',
      uk: 'Обирає орбіту й ракету-носій та стежить за лімітом маси.',
    },
  },
  comms: {
    name: { en: 'Comms & Ops', uk: "Зв'язок і ЦУП" },
    segment: { en: 'Ground Segment', uk: 'Наземний сегмент' },
    description: {
      en: 'Handles antennas, ground stations and downlink capacity.',
      uk: 'Відповідає за антени, наземні станції та пропускну здатність каналу.',
    },
  },
}

export function sortPlayers(players: Player[]): Player[] {
  return [...players].sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id))
}

/** Власник кімнати. Якщо він вийшов, власником стає найстаріший гравець онлайн. */
export function resolveHostId(rawHostId: string, players: Player[]): string {
  const active = sortPlayers(players.filter((p) => p.online))
  if (active.some((p) => p.id === rawHostId)) return rawHostId
  return active[0]?.id ?? rawHostId
}

/** Скільки ролей може забрати один гість (не власник) */
export function claimQuota(activeCount: number): number {
  return activeCount === 2 ? 2 : 1
}

/**
 * Хто яку роль має. Роль йде гостю, якщо він її "заявив", онлайн і не перевищив квоту.
 * Усе інше автоматично дістається власнику.
 */
export function computeRoleOwners(
  rawHostId: string,
  players: Player[],
  claims: Partial<Record<PlayerRole, string>>,
): Record<PlayerRole, string> {
  const hostId = resolveHostId(rawHostId, players)
  const activeIds = new Set(players.filter((p) => p.online).map((p) => p.id))
  const quota = claimQuota(activeIds.size)
  const taken: Record<string, number> = {}
  const owners = {} as Record<PlayerRole, string>

  for (const role of ROLES) {
    const claimant = claims[role]
    const used = claimant ? (taken[claimant] ?? 0) : 0
    if (claimant && claimant !== hostId && activeIds.has(claimant) && used < quota) {
      taken[claimant] = used + 1
      owners[role] = claimant
    } else {
      owners[role] = hostId
    }
  }
  return owners
}