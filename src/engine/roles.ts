import type { LocalizedText, Player, PlayerRole } from '../types/game'

export const MAX_PLAYERS = 4
export const ROLES: PlayerRole[] = ['science', 'bus', 'flight', 'comms']

export interface RoleInfo {
  name: LocalizedText
  description: LocalizedText
}

export const ROLE_INFO: Record<PlayerRole, RoleInfo> = {
  science: {
    name: { en: 'Science Lead', uk: 'Науковий керівник' },
    description: {
      en: 'Selects and installs scientific instruments.',
      uk: 'Обирає та встановлює прилади.',
    },
  },
  bus: {
    name: { en: 'Spacecraft Engineer', uk: 'Інженер апарата' },
    description: {
      en: 'Selects the platform and manages instrument power supply.',
      uk: 'Обирає платформу, відповідає за живлення приладів.',
    },
  },
  flight: {
    name: { en: 'Flight Engineer', uk: 'Інженер польоту' },
    description: {
      en: 'Selects the launch vehicle and manages spacecraft control.',
      uk: 'Обирає ракету-носій, відповідає за керування пристроєм.',
    },
  },
  comms: {
    name: { en: 'Communications Officer', uk: "Зв'язківець" },
    description: {
      en: 'Responsible for antennas and transmitter bandwidth.',
      uk: 'Відповідальний за антени та пропускну здатність передавачів.',
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