import { describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'
import { theme_flow_machine } from '$lib/flows/theme_flow'
import type { ThemePort } from '$lib/ports/theme_port'

function create_theme_port(overrides?: Partial<ThemePort>): ThemePort {
  return {
    get_theme: () => 'system',
    set_theme: () => {},
    get_resolved_theme: () => 'light',
    ...overrides
  }
}

describe('theme_flow', () => {
  it('dispatches ui_theme_set on success', () => {
    const dispatch_many = vi.fn()
    const actor = createActor(theme_flow_machine, {
      input: {
        ports: { theme: create_theme_port() },
        dispatch_many
      }
    }).start()

    actor.send({ type: 'SET_THEME', theme: 'dark' })

    expect(dispatch_many).toHaveBeenCalledWith([{ type: 'ui_theme_set', theme: 'dark' }])
  })

  it('dispatches ui_theme_set_failed when the port throws', () => {
    const dispatch_many = vi.fn()
    const actor = createActor(theme_flow_machine, {
      input: {
        ports: {
          theme: create_theme_port({
            set_theme: () => {
              throw new Error('boom')
            }
          })
        },
        dispatch_many
      }
    }).start()

    actor.send({ type: 'SET_THEME', theme: 'dark' })

    expect(dispatch_many).toHaveBeenCalledWith([
      { type: 'ui_theme_set_failed', error: 'Error: boom' }
    ])
  })
})
