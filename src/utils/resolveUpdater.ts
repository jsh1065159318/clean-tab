export type StateUpdater<T> = T | ((current: T) => T)

export const resolveUpdater = <T>(value: StateUpdater<T>, currentValue: T): T =>
  typeof value === 'function' ? (value as (current: T) => T)(currentValue) : value
