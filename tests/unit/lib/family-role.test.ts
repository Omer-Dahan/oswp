import { getOrganizationRoleLabel } from '~/lib/organization-roles'
import { organizationRoles } from '~/lib/auth-permissions'
import { readWorkspaceCapabilities } from '~/server/authz/workspace-capabilities'

describe('family role', () => {
  it('grants budget, guest import, and vendor quote permissions', () => {
    expect(organizationRoles.family.authorize({ budget: ['update'] }).success).toBe(true)
    expect(organizationRoles.family.authorize({ guest: ['import'] }).success).toBe(true)
    expect(organizationRoles.family.authorize({ vendor_quote: ['create'] }).success).toBe(true)
  })

  it('allows reading the website but not publishing it', () => {
    expect(organizationRoles.family.authorize({ website: ['publish'] }).success).toBe(false)
    expect(organizationRoles.family.authorize({ website: ['read'] }).success).toBe(true)
  })

  it('cannot manage members', () => {
    expect(organizationRoles.family.authorize({ member: ['update'] }).success).toBe(false)
  })

  it('can view planning but not access settings', () => {
    const capabilities = readWorkspaceCapabilities('family')
    expect(capabilities.canViewPlanning).toBe(true)
    expect(capabilities.canAccessSettings).toBe(false)
  })

  it('member can access settings', () => {
    expect(readWorkspaceCapabilities('member').canAccessSettings).toBe(true)
  })

  it('labels the family role in Hebrew', () => {
    expect(getOrganizationRoleLabel('family')).toBe('משפחה')
  })
})
