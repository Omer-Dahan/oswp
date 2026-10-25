export const organizationRoleOptions = [
  { label: 'מנהל', value: 'admin' },
  { label: 'חבר', value: 'member' },
  { label: 'משפחה', value: 'family' },
  { label: 'צופה', value: 'viewer' },
] as const

export type OrganizationRoleOption = (typeof organizationRoleOptions)[number]['value']

export const authUiCustomOrganizationRoles: { label: string; role: string }[] = [
  { role: 'member', label: 'חבר' },
  { role: 'family', label: 'משפחה' },
  { role: 'viewer', label: 'צופה' },
]

const roleLabelByValue: Record<string, string> = {
  owner: 'בעלים',
  admin: 'מנהל',
  member: 'חבר',
  family: 'משפחה',
  viewer: 'צופה',
}

export function getOrganizationRoleLabel(role: string): string {
  const normalizedRole = role.trim().toLowerCase()
  if (!normalizedRole) {
    return 'חבר'
  }

  return (
    roleLabelByValue[normalizedRole] ??
    normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1)
  )
}
