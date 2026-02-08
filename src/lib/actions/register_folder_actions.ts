import { SvelteMap, SvelteSet } from 'svelte/reactivity'
import { ACTION_IDS } from '$lib/actions/action_ids'
import type { ActionRegistrationInput } from '$lib/actions/action_registration_input'
import type { FolderLoadState } from '$lib/types/filetree'
import { parent_folder_path } from '$lib/utils/filetree'

function should_load_folder(state: FolderLoadState | undefined): boolean {
  return !state || state === 'unloaded' || state === 'error'
}

function reset_filetree(input: ActionRegistrationInput) {
  input.stores.ui.filetree = {
    expanded_paths: new SvelteSet<string>(),
    load_states: new SvelteMap<string, FolderLoadState>(),
    error_messages: new SvelteMap<string, string>()
  }
}

function set_load_state(
  input: ActionRegistrationInput,
  path: string,
  state: FolderLoadState,
  error: string | null
) {
  const load_states = new SvelteMap(input.stores.ui.filetree.load_states)
  load_states.set(path, state)

  const error_messages = new SvelteMap(input.stores.ui.filetree.error_messages)
  if (error) {
    error_messages.set(path, error)
  } else {
    error_messages.delete(path)
  }

  input.stores.ui.filetree = {
    ...input.stores.ui.filetree,
    load_states,
    error_messages
  }
}

function close_create_dialog(input: ActionRegistrationInput) {
  input.stores.ui.create_folder_dialog = {
    open: false,
    parent_path: '',
    folder_name: ''
  }
}

function close_delete_dialog(input: ActionRegistrationInput) {
  input.stores.ui.delete_folder_dialog = {
    open: false,
    folder_path: null,
    affected_note_count: 0,
    affected_folder_count: 0,
    status: 'idle'
  }
}

function close_rename_dialog(input: ActionRegistrationInput) {
  input.stores.ui.rename_folder_dialog = {
    open: false,
    folder_path: null,
    new_name: ''
  }
}

function folder_name_from_path(path: string): string {
  const i = path.lastIndexOf('/')
  return i >= 0 ? path.slice(i + 1) : path
}

function build_folder_path_from_name(parent: string, name: string): string {
  return parent ? `${parent}/${name}` : name
}

function remove_expanded_paths(input: ActionRegistrationInput, folder_path: string) {
  const prefix = `${folder_path}/`
  const expanded_paths = new SvelteSet<string>()

  for (const path of input.stores.ui.filetree.expanded_paths) {
    if (path === folder_path || path.startsWith(prefix)) {
      continue
    }
    expanded_paths.add(path)
  }

  input.stores.ui.filetree = {
    ...input.stores.ui.filetree,
    expanded_paths
  }
}

function remap_expanded_paths(input: ActionRegistrationInput, old_path: string, new_path: string) {
  const old_prefix = `${old_path}/`
  const new_prefix = `${new_path}/`
  const expanded_paths = new SvelteSet<string>()

  for (const path of input.stores.ui.filetree.expanded_paths) {
    if (path === old_path) {
      expanded_paths.add(new_path)
      continue
    }
    if (path.startsWith(old_prefix)) {
      expanded_paths.add(`${new_prefix}${path.slice(old_prefix.length)}`)
      continue
    }
    expanded_paths.add(path)
  }

  input.stores.ui.filetree = {
    ...input.stores.ui.filetree,
    expanded_paths
  }
}

async function load_folder(input: ActionRegistrationInput, path: string): Promise<void> {
  const current_state = input.stores.ui.filetree.load_states.get(path)
  if (!should_load_folder(current_state)) {
    return
  }

  set_load_state(input, path, 'loading', null)
  const generation = input.stores.vault.generation
  const result = await input.services.folder.load_folder(path, generation)

  if (result.status === 'loaded') {
    set_load_state(input, path, 'loaded', null)
    return
  }

  if (result.status === 'failed') {
    set_load_state(input, path, 'error', result.error)
  }
}

export function register_folder_actions(input: ActionRegistrationInput) {
  const { registry, stores, services } = input

  registry.register({
    id: ACTION_IDS.folder_request_create,
    label: 'Request Create Folder',
    execute: (parent_path: unknown) => {
      stores.ui.create_folder_dialog = {
        open: true,
        parent_path: String(parent_path),
        folder_name: ''
      }
      stores.op.reset('folder.create')
    }
  })

  registry.register({
    id: ACTION_IDS.folder_update_create_name,
    label: 'Update Create Folder Name',
    execute: (name: unknown) => {
      stores.ui.create_folder_dialog.folder_name = String(name)
    }
  })

  registry.register({
    id: ACTION_IDS.folder_confirm_create,
    label: 'Confirm Create Folder',
    execute: async () => {
      const { parent_path, folder_name } = stores.ui.create_folder_dialog
      const result = await services.folder.create_folder(parent_path, folder_name)
      if (result.status === 'success') {
        close_create_dialog(input)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.folder_cancel_create,
    label: 'Cancel Create Folder',
    execute: () => {
      close_create_dialog(input)
      stores.op.reset('folder.create')
    }
  })

  registry.register({
    id: ACTION_IDS.folder_toggle,
    label: 'Toggle Folder',
    execute: async (path: unknown) => {
      const folder_path = String(path)
      const expanded_paths = new SvelteSet(stores.ui.filetree.expanded_paths)

      if (expanded_paths.has(folder_path)) {
        expanded_paths.delete(folder_path)
        stores.ui.filetree = {
          ...stores.ui.filetree,
          expanded_paths
        }
        return
      }

      expanded_paths.add(folder_path)
      stores.ui.filetree = {
        ...stores.ui.filetree,
        expanded_paths
      }

      await load_folder(input, folder_path)
    }
  })

  registry.register({
    id: ACTION_IDS.folder_retry_load,
    label: 'Retry Folder Load',
    execute: async (path: unknown) => {
      await load_folder(input, String(path))
    }
  })

  registry.register({
    id: ACTION_IDS.folder_collapse_all,
    label: 'Collapse All Folders',
    execute: () => {
      stores.ui.filetree = {
        ...stores.ui.filetree,
        expanded_paths: new SvelteSet<string>()
      }
    }
  })

  registry.register({
    id: ACTION_IDS.folder_refresh_tree,
    label: 'Refresh File Tree',
    execute: async () => {
      reset_filetree(input)
      await load_folder(input, '')
    }
  })

  registry.register({
    id: ACTION_IDS.folder_request_delete,
    label: 'Request Delete Folder',
    execute: async (folder_path: unknown) => {
      const normalized_path = String(folder_path)

      stores.ui.delete_folder_dialog = {
        open: true,
        folder_path: normalized_path,
        affected_note_count: 0,
        affected_folder_count: 0,
        status: 'fetching_stats'
      }

      stores.op.reset('folder.delete')
      const result = await services.folder.load_delete_stats(normalized_path)

      if (result.status === 'ready') {
        stores.ui.delete_folder_dialog = {
          ...stores.ui.delete_folder_dialog,
          status: 'confirming',
          affected_note_count: result.affected_note_count,
          affected_folder_count: result.affected_folder_count
        }
      }
    }
  })

  registry.register({
    id: ACTION_IDS.folder_confirm_delete,
    label: 'Confirm Delete Folder',
    execute: async () => {
      const folder_path = stores.ui.delete_folder_dialog.folder_path
      if (!folder_path) return

      const result = await services.folder.delete_folder(folder_path)
      if (result.status === 'success') {
        remove_expanded_paths(input, folder_path)
        close_delete_dialog(input)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.folder_cancel_delete,
    label: 'Cancel Delete Folder',
    execute: () => {
      close_delete_dialog(input)
      stores.op.reset('folder.delete')
    }
  })

  registry.register({
    id: ACTION_IDS.folder_retry_delete,
    label: 'Retry Delete Folder',
    execute: async () => {
      const folder_path = stores.ui.delete_folder_dialog.folder_path
      if (!folder_path) return

      const result = await services.folder.delete_folder(folder_path)
      if (result.status === 'success') {
        remove_expanded_paths(input, folder_path)
        close_delete_dialog(input)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.folder_request_rename,
    label: 'Request Rename Folder',
    execute: (folder_path: unknown) => {
      const path = String(folder_path)
      stores.ui.rename_folder_dialog = {
        open: true,
        folder_path: path,
        new_name: folder_name_from_path(path)
      }
      stores.op.reset('folder.rename')
    }
  })

  registry.register({
    id: ACTION_IDS.folder_rename,
    label: 'Update Rename Folder Name',
    execute: (name: unknown) => {
      stores.ui.rename_folder_dialog.new_name = String(name)
    }
  })

  registry.register({
    id: ACTION_IDS.folder_confirm_rename,
    label: 'Confirm Rename Folder',
    execute: async () => {
      const folder_path = stores.ui.rename_folder_dialog.folder_path
      const new_name = stores.ui.rename_folder_dialog.new_name.trim()
      if (!folder_path || !new_name) return

      const parent = parent_folder_path(folder_path)
      const new_path = build_folder_path_from_name(parent, new_name)

      const result = await services.folder.rename_folder(folder_path, new_path)
      if (result.status === 'success') {
        remap_expanded_paths(input, folder_path, new_path)
        close_rename_dialog(input)
      }
    }
  })

  registry.register({
    id: ACTION_IDS.folder_cancel_rename,
    label: 'Cancel Rename Folder',
    execute: () => {
      close_rename_dialog(input)
      stores.op.reset('folder.rename')
    }
  })

  registry.register({
    id: ACTION_IDS.folder_retry_rename,
    label: 'Retry Rename Folder',
    execute: async () => {
      const folder_path = stores.ui.rename_folder_dialog.folder_path
      const new_name = stores.ui.rename_folder_dialog.new_name.trim()
      if (!folder_path || !new_name) return

      const parent = parent_folder_path(folder_path)
      const new_path = build_folder_path_from_name(parent, new_name)

      const result = await services.folder.rename_folder(folder_path, new_path)
      if (result.status === 'success') {
        remap_expanded_paths(input, folder_path, new_path)
        close_rename_dialog(input)
      }
    }
  })
}
