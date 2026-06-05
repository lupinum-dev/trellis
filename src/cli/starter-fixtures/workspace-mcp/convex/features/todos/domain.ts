import { mutation, query } from '../../functions'
import { createTodoOp, listTodosOp } from './operations'

export const list = query.workspace(listTodosOp)
export const create = mutation.workspace(createTodoOp)
