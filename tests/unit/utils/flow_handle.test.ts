import { describe, it, expect } from 'vitest'
import type { FlowSnapshot } from '$lib/flows/flow_handle'

describe('flow_handle types', () => {
  it('accepts context and matches', () => {
    const snapshot: FlowSnapshot<{ value: number }> = {
      context: { value: 1 },
      matches: () => true
    }

    expect(snapshot.context.value).toBe(1)
    expect(snapshot.matches('any')).toBe(true)
  })
})
