import { $prose } from '@milkdown/kit/utils'
import { Plugin, PluginKey } from '@milkdown/kit/prose/state'
import type { EditorView } from '@milkdown/kit/prose/view'

export const wiki_suggest_plugin_key = new PluginKey<WikiSuggestState>('wiki-suggest')

type SuggestionItem = { title: string; path: string }

type WikiSuggestState = {
  active: boolean
  query: string
  from: number
  items: SuggestionItem[]
  selected_index: number
}

const EMPTY_STATE: WikiSuggestState = {
  active: false,
  query: '',
  from: 0,
  items: [],
  selected_index: 0
}

function extract_wiki_query(text_before: string): { query: string; bracket_pos: number } | null {
  const open_idx = text_before.lastIndexOf('[[')
  if (open_idx === -1) return null
  const after_open = text_before.slice(open_idx + 2)
  if (after_open.includes(']]') || after_open.includes('\n')) return null
  const pipe_idx = after_open.indexOf('|')
  const query = pipe_idx >= 0 ? after_open.slice(pipe_idx + 1) : after_open
  return { query, bracket_pos: open_idx }
}

function create_dropdown(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'WikiSuggest'
  el.style.position = 'absolute'
  el.style.display = 'none'
  el.style.zIndex = '50'
  return el
}

function position_dropdown(dropdown: HTMLElement, view: EditorView, pos: number) {
  try {
    const coords = view.coordsAtPos(pos)
    const parent = dropdown.offsetParent
    if (!parent) return
    const parent_rect = parent.getBoundingClientRect()
    dropdown.style.left = `${String(coords.left - parent_rect.left)}px`
    dropdown.style.top = `${String(coords.bottom - parent_rect.top + 4)}px`
  } catch {
    // position may be invalid if doc changed
  }
}

function render_items(
  dropdown: HTMLElement,
  items: SuggestionItem[],
  selected_index: number,
  on_select: (index: number) => void
) {
  dropdown.innerHTML = ''
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue
    const row = document.createElement('button')
    row.className = 'WikiSuggest__item'
    if (i === selected_index) row.classList.add('WikiSuggest__item--selected')
    row.textContent = item.title
    row.addEventListener('mousedown', (e) => {
      e.preventDefault()
      on_select(i)
    })
    dropdown.appendChild(row)
  }
}

export function create_wiki_suggest_prose_plugin(input: {
  on_query: (query: string) => void
  on_dismiss: () => void
}): Plugin<WikiSuggestState> {
  let dropdown: HTMLElement | null = null
  let debounce_timer: ReturnType<typeof setTimeout> | null = null

  function get_state(view: EditorView): WikiSuggestState {
    return wiki_suggest_plugin_key.getState(view.state) ?? EMPTY_STATE
  }

  function accept(view: EditorView, index: number) {
    const state = get_state(view)
    const item = state.items[index]
    if (!item) return
    const replacement = `[[${item.title}]]`
    const tr = view.state.tr.replaceWith(
      state.from,
      view.state.selection.from,
      view.state.schema.text(replacement)
    )
    tr.setMeta(wiki_suggest_plugin_key, EMPTY_STATE)
    view.dispatch(tr)
    view.focus()
    input.on_dismiss()
  }

  function sync_dropdown(view: EditorView, state: WikiSuggestState) {
    if (!dropdown) return
    if (!state.active || state.items.length === 0) {
      dropdown.style.display = 'none'
      return
    }
    dropdown.style.display = 'block'
    position_dropdown(dropdown, view, state.from)
    render_items(dropdown, state.items, state.selected_index, (i) => { accept(view, i) })
  }

  return new Plugin<WikiSuggestState>({
    key: wiki_suggest_plugin_key,

    state: {
      init: () => EMPTY_STATE,
      apply(tr, prev) {
        const meta = tr.getMeta(wiki_suggest_plugin_key) as WikiSuggestState | { items: SuggestionItem[] } | undefined
        if (meta) {
          if ('active' in meta) return meta
          if ('items' in meta) return { ...prev, items: meta.items, selected_index: 0 }
        }
        return prev
      }
    },

    view(editor_view) {
      dropdown = create_dropdown()
      editor_view.dom.parentElement?.appendChild(dropdown)

      return {
        update(view) {
          const { state: editor_state } = view
          const cursor = editor_state.selection.from
          const plugin_state = get_state(view)

          if (!editor_state.selection.empty) {
            if (plugin_state.active) {
              view.dispatch(view.state.tr.setMeta(wiki_suggest_plugin_key, EMPTY_STATE))
              input.on_dismiss()
            }
            return
          }

          const text_before = editor_state.doc.textBetween(0, cursor, '\n')
          const result = extract_wiki_query(text_before)

          if (!result) {
            if (plugin_state.active) {
              view.dispatch(view.state.tr.setMeta(wiki_suggest_plugin_key, EMPTY_STATE))
              input.on_dismiss()
            }
            return
          }

          if (result.query !== plugin_state.query || !plugin_state.active) {
            const new_state: WikiSuggestState = {
              active: true,
              query: result.query,
              from: result.bracket_pos,
              items: plugin_state.active ? plugin_state.items : [],
              selected_index: 0
            }
            view.dispatch(view.state.tr.setMeta(wiki_suggest_plugin_key, new_state))

            if (debounce_timer) clearTimeout(debounce_timer)
            debounce_timer = setTimeout(() => { input.on_query(result.query) }, 50)
          }

          sync_dropdown(view, get_state(view))
        },
        destroy() {
          dropdown?.remove()
          dropdown = null
          if (debounce_timer) clearTimeout(debounce_timer)
        }
      }
    },

    props: {
      handleKeyDown(view, event) {
        const state = get_state(view)
        if (!state.active || state.items.length === 0) return false

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          const next = (state.selected_index + 1) % state.items.length
          view.dispatch(view.state.tr.setMeta(wiki_suggest_plugin_key, { ...state, selected_index: next }))
          sync_dropdown(view, { ...state, selected_index: next })
          return true
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault()
          const prev = (state.selected_index - 1 + state.items.length) % state.items.length
          view.dispatch(view.state.tr.setMeta(wiki_suggest_plugin_key, { ...state, selected_index: prev }))
          sync_dropdown(view, { ...state, selected_index: prev })
          return true
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          accept(view, state.selected_index)
          return true
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          view.dispatch(view.state.tr.setMeta(wiki_suggest_plugin_key, EMPTY_STATE))
          input.on_dismiss()
          sync_dropdown(view, EMPTY_STATE)
          return true
        }

        return false
      }
    }
  })
}

export function set_wiki_suggestions(view: EditorView, items: SuggestionItem[]) {
  view.dispatch(view.state.tr.setMeta(wiki_suggest_plugin_key, { items }))
}

export const create_wiki_suggest_plugin = (input: {
  on_query: (query: string) => void
  on_dismiss: () => void
}) =>
  $prose(() => create_wiki_suggest_prose_plugin(input))
