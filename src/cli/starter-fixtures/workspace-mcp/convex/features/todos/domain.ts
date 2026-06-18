import { mutation, query } from '../../functions'
import { createTodoOperation, listTodosOperation } from './operations'

export const list = query.workspace(listTodosOperation)
export const create = mutation.workspace(createTodoOperation)
