import { mutation } from '../../functions'
import { createProjectOperation, deleteProjectOperation } from './operations'

export const createProject = mutation.workspace(createProjectOperation as never)
export const deleteProject = mutation.workspace(deleteProjectOperation as never)
export const previewDeleteProject = mutation.workspace.preview(deleteProjectOperation as never)
