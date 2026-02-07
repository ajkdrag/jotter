export type AppAction = {
  id: string
  label: string
  shortcut?: string
  when?: () => boolean
  execute: (...args: unknown[]) => void | Promise<void>
}

export class ActionRegistry {
  private actions = new Map<string, AppAction>()

  register(action: AppAction) {
    this.actions.set(action.id, action)
  }

  async execute(id: string, ...args: unknown[]) {
    const action = this.actions.get(id)
    if (!action) {
      throw new Error(`Unknown action: ${id}`)
    }

    if (action.when && !action.when()) {
      return
    }

    await action.execute(...args)
  }

  get_all(): AppAction[] {
    return [...this.actions.values()]
  }

  get_available(): AppAction[] {
    return this.get_all().filter((action) => !action.when || action.when())
  }
}
