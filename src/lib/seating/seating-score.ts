/**
 * Seating affinity scoring - pure, deterministic. No Prisma, no React.
 *
 * Scores how well an existing table fits a household group, based on who's
 * already seated there (affinity/side) and where the table physically sits
 * relative to the group's other tables (proximity). Never invents tables.
 */

export const W_AFFINITY = 1000
export const W_SIDE = 200
export const W_ADJACENCY = 1
export const W_WASTE = 10

export type SeatingTable = {
  id: string
  name: string
  capacity: number
  positionX: number
  positionY: number
  guestIds: number[]
}

export type SeatingHousehold = {
  id: string
  side: string | null
  groupName: string | null
  seatWeight: number
  guestIds: number[]
}

export type SeatingGroup = {
  side: string | null
  groupName: string | null
  households: SeatingHousehold[]
}

export type TableScore = {
  tableId: string
  score: number
}

export type PlacementSuggestion = {
  tableId: string
  score: number
  reason: string
}

const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

const householdOfGuest = (
  households: readonly SeatingHousehold[],
  guestId: number
): SeatingHousehold | undefined => households.find((household) => household.guestIds.includes(guestId))

const groupWeight = (group: SeatingGroup): number =>
  group.households.reduce((total, household) => total + household.seatWeight, 0)

// How many of a table's current occupants belong to households of this same side+group
const matchingHouseholdCount = (
  table: SeatingTable,
  group: SeatingGroup,
  allHouseholds: readonly SeatingHousehold[]
): number => {
  const matched = new Set<string>()
  for (const guestId of table.guestIds) {
    const household = householdOfGuest(allHouseholds, guestId)
    if (household && household.side === group.side && household.groupName === group.groupName) {
      matched.add(household.id)
    }
  }
  return matched.size
}

const hasSideMatch = (
  table: SeatingTable,
  group: SeatingGroup,
  allHouseholds: readonly SeatingHousehold[]
): boolean =>
  table.guestIds.some((guestId) => householdOfGuest(allHouseholds, guestId)?.side === group.side)

// Center of gravity of tables that already seat a household from this side+group
const groupCenter = (
  tables: readonly SeatingTable[],
  group: SeatingGroup,
  allHouseholds: readonly SeatingHousehold[]
): { x: number; y: number } | undefined => {
  let sumX = 0
  let sumY = 0
  let count = 0
  for (const table of tables) {
    if (matchingHouseholdCount(table, group, allHouseholds) > 0) {
      sumX += table.positionX
      sumY += table.positionY
      count += 1
    }
  }
  if (count === 0) return undefined
  return { x: sumX / count, y: sumY / count }
}

const distance = (ax: number, ay: number, bx: number, by: number): number =>
  Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)

const occupiedWeight = (table: SeatingTable, allHouseholds: readonly SeatingHousehold[]): number => {
  let total = 0
  for (const guestId of table.guestIds) {
    const household = householdOfGuest(allHouseholds, guestId)
    if (household) total += household.seatWeight / household.guestIds.length
  }
  return total
}

export const scoreTableForGroup = (
  table: SeatingTable,
  group: SeatingGroup,
  tables: readonly SeatingTable[],
  allHouseholds: readonly SeatingHousehold[]
): number => {
  const affinityMatch = matchingHouseholdCount(table, group, allHouseholds) > 0 ? 1 : 0
  const sideMatch = hasSideMatch(table, group, allHouseholds) ? 1 : 0

  const center = groupCenter(tables, group, allHouseholds)
  const distanceToGroupCenter = center ? distance(table.positionX, table.positionY, center.x, center.y) : 0

  const weight = groupWeight(group)
  const occupied = occupiedWeight(table, allHouseholds)
  const remainingCapacity = Math.max(0, table.capacity - occupied)
  const wastedSeats = Math.max(0, remainingCapacity - weight)

  return (
    W_AFFINITY * affinityMatch +
    W_SIDE * sideMatch -
    W_ADJACENCY * distanceToGroupCenter -
    W_WASTE * wastedSeats
  )
}

const compareScores = (a: TableScore, b: TableScore): number => b.score - a.score || cmpStr(a.tableId, b.tableId)

const nearestNeighborName = (
  table: SeatingTable,
  tables: readonly SeatingTable[],
  group: SeatingGroup,
  allHouseholds: readonly SeatingHousehold[]
): string | undefined => {
  let best: { table: SeatingTable; dist: number } | undefined
  for (const other of tables) {
    if (other.id === table.id) continue
    if (matchingHouseholdCount(other, group, allHouseholds) === 0) continue
    const dist = distance(table.positionX, table.positionY, other.positionX, other.positionY)
    if (!best || dist < best.dist || (dist === best.dist && cmpStr(other.id, best.table.id) < 0)) {
      best = { table: other, dist }
    }
  }
  return best?.table.name
}

const buildReason = (
  table: SeatingTable,
  group: SeatingGroup,
  tables: readonly SeatingTable[],
  allHouseholds: readonly SeatingHousehold[]
): string => {
  const tableLabel = table.name.startsWith('שולחן') ? table.name : `שולחן ${table.name}`
  const base = `${tableLabel}: ${group.households.length} משקי בית מקבוצת ${group.groupName ?? ''}`
  const neighbor = nearestNeighborName(table, tables, group, allHouseholds)
  return neighbor ? `${base}, ליד שולחן ${neighbor}` : base
}

export const suggestPlacements = ({
  group,
  tables,
  households,
  maxResults = 3,
}: {
  group: SeatingGroup
  tables: SeatingTable[]
  households: SeatingHousehold[]
  maxResults?: number
}): PlacementSuggestion[] => {
  const scores: TableScore[] = tables.map((table) => ({
    tableId: table.id,
    score: scoreTableForGroup(table, group, tables, households),
  }))

  scores.sort(compareScores)

  const tablesById = new Map(tables.map((table) => [table.id, table]))

  return scores.slice(0, maxResults).map(({ tableId, score }) => {
    const table = tablesById.get(tableId)
    if (!table) throw new Error(`Unknown table: ${tableId}`)
    return {
      tableId,
      score,
      reason: buildReason(table, group, tables, households),
    }
  })
}
