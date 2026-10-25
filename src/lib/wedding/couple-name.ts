type CoupleNameInput = {
  groomFirstName?: string | null
  brideFirstName?: string | null
}

const clean = (name?: string | null) => name?.trim() ?? ''

function joinNames({ groomFirstName, brideFirstName }: CoupleNameInput, separator: string) {
  const groom = clean(groomFirstName)
  const bride = clean(brideFirstName)
  if (groom && bride) return `${groom}${separator}${bride}`
  return groom || bride || null
}

export function coupleNames(names: CoupleNameInput, separator = ' & '): string | null {
  return joinNames(names, separator)
}

export function coupleNamesHe(names: CoupleNameInput): string | null {
  return joinNames(names, ' ו')
}

export function coupleInitials(names: CoupleNameInput): string | null {
  const groomInitial = clean(names.groomFirstName)[0] ?? ''
  const brideInitial = clean(names.brideFirstName)[0] ?? ''
  if (groomInitial && brideInitial) return `${groomInitial} & ${brideInitial}`
  return groomInitial || brideInitial || null
}
