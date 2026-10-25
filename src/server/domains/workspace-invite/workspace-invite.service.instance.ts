import { auth } from '~/lib/auth'
import { provisionWeddingWorkspace } from '~/server/application/workspace/provision-wedding-workspace'
import { db } from '~/server/db'
import { WorkspaceInviteService } from '~/server/domains/workspace-invite/workspace-invite.service'

export const workspaceInviteService = new WorkspaceInviteService(
  db,
  (args) => auth.api.signUpEmail(args),
  provisionWeddingWorkspace
)
