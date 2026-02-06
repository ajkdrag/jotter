import type { FlowHandle, FlowSnapshot } from '$lib/flows/flow_handle'
import type { EditorFlowContext, EditorFlowEvents } from '$lib/flows/editor_flow'
import type { EditorFlushResult } from '$lib/shell/editor_runtime'

export type EditorFlowHandle = FlowHandle<EditorFlowEvents, FlowSnapshot<EditorFlowContext>>

export async function flush_editor(editor_flow: EditorFlowHandle): Promise<EditorFlushResult | null> {
  const snapshot = editor_flow.get_snapshot()

  if (snapshot.matches('unmounted')) return null
  if (snapshot.matches('error')) {
    throw new Error(snapshot.context.error ?? 'Editor flow is in error state')
  }

  const wait_for_ready = () =>
    new Promise<void>((resolve, reject) => {
      const unsubscribe = editor_flow.subscribe((s) => {
        if (s.matches('ready') || s.matches('unmounted')) {
          unsubscribe()
          resolve()
          return
        }
        if (s.matches('error')) {
          unsubscribe()
          reject(new Error(s.context.error ?? 'Editor flow failed'))
        }
      })
    })

  if (snapshot.matches('flushing')) {
    const previous_revision = snapshot.context.flush_revision
    await wait_for_ready()
    const settled = editor_flow.get_snapshot()
    if (settled.context.flush_revision <= previous_revision) return null
    return settled.context.last_flush
  }

  if (!snapshot.matches('ready')) return null

  const previous_revision = snapshot.context.flush_revision
  const completion = wait_for_ready()
  editor_flow.send({ type: 'FLUSH_REQUESTED' })
  await completion
  const settled = editor_flow.get_snapshot()
  if (settled.context.flush_revision <= previous_revision) return null
  return settled.context.last_flush
}
