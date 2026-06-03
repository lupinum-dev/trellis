import { mutation, query } from '../../functions'
import { createTodoOp, listTodosOp } from './operations'

export const list = query.protected(listTodosOp)
export const create = mutation.protected(createTodoOp)
