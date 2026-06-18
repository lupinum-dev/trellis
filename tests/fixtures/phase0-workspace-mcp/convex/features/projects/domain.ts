import { mutation } from '../../functions'
import { createProjectOperation, deleteProjectOperation } from './operations'

export const createProject = mutation.workspace(createProjectOperation)
export const deleteProject = mutation.workspace(deleteProjectOperation)
export const previewDeleteProject = mutation.workspace.preview(deleteProjectOperation)
