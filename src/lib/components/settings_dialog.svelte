<script lang="ts">
import * as Dialog from '$lib/components/ui/dialog/index.js'
import * as Select from '$lib/components/ui/select/index.js'
import * as Slider from '$lib/components/ui/slider/index.js'
import * as Switch from '$lib/components/ui/switch/index.js'
import { Button } from '$lib/components/ui/button'
import { Input } from '$lib/components/ui/input'
import { Separator } from '$lib/components/ui/separator'
	import TypeIcon from '@lucide/svelte/icons/type'
	import LayoutIcon from '@lucide/svelte/icons/layout-template'
	import Link2Icon from '@lucide/svelte/icons/link-2'
	import FolderIcon from '@lucide/svelte/icons/folder'
	import type { EditorSettings } from '$lib/types/editor_settings'

type Props = {
  open: boolean
  editor_settings: EditorSettings
  is_saving: boolean
  has_unsaved_changes: boolean
  error: string | null
  on_update_settings: (settings: EditorSettings) => void
  on_save: () => void
  on_close: () => void
}

let { open, editor_settings, is_saving, has_unsaved_changes, error, on_update_settings, on_save, on_close }: Props = $props()

let font_size_value = $derived(editor_settings.font_size)
let line_height_value = $derived(editor_settings.line_height)

function handle_font_size_change(value: number) {
  on_update_settings({ ...editor_settings, font_size: value })
}

function handle_line_height_change(value: number) {
  on_update_settings({ ...editor_settings, line_height: value })
}

function handle_heading_color_change(value: string | undefined) {
  if (value) {
    on_update_settings({ ...editor_settings, heading_color: value as EditorSettings['heading_color'] })
  }
}

	function handle_spacing_change(value: string | undefined) {
		if (value) {
			on_update_settings({ ...editor_settings, spacing: value as EditorSettings['spacing'] })
		}
	}

	function handle_link_syntax_change(value: string | undefined) {
		if (value) {
			on_update_settings({ ...editor_settings, link_syntax: value as EditorSettings['link_syntax'] })
		}
	}

	function handle_attachment_folder_change(value: string) {
		on_update_settings({ ...editor_settings, attachment_folder: value })
	}

	function handle_show_hidden_files_change(checked: boolean) {
		on_update_settings({ ...editor_settings, show_hidden_files: checked })
	}

	const heading_color_options = [
		{ value: 'inherit', label: 'Inherit' },
		{ value: 'primary', label: 'Primary' },
		{ value: 'accent', label: 'Accent' }
	]

	const spacing_options = [
		{ value: 'compact', label: 'Compact' },
		{ value: 'normal', label: 'Normal' },
		{ value: 'spacious', label: 'Spacious' }
	]

	const link_syntax_options = [
		{ value: 'wikilink', label: 'Wikilinks ([[note]])' },
		{ value: 'markdown', label: 'Markdown links ([note](note.md))' }
	]
	</script>

<Dialog.Root {open} onOpenChange={(value: boolean) => { if (!value) on_close() }}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title class="text-lg font-semibold">Settings</Dialog.Title>
      <Dialog.Description class="text-sm text-muted-foreground">
        Customize your editor experience
      </Dialog.Description>
    </Dialog.Header>

    <div class="flex flex-col gap-6 py-2">
      <section class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <TypeIcon class="size-4 text-muted-foreground" />
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Typography</span>
        </div>

        <div class="flex flex-col gap-5">
          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">Font Size</span>
              <span class="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{editor_settings.font_size.toFixed(2)}rem</span>
            </div>
            <Slider.Root
              type="single"
              value={font_size_value}
              onValueChange={handle_font_size_change}
              min={0.875}
              max={1.25}
              step={0.0625}
              class="w-full"
            />
          </div>

          <div class="flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">Line Height</span>
              <span class="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{editor_settings.line_height.toFixed(2)}</span>
            </div>
            <Slider.Root
              type="single"
              value={line_height_value}
              onValueChange={handle_line_height_change}
              min={1.5}
              max={2.0}
              step={0.05}
              class="w-full"
            />
          </div>

	          <div class="flex items-center justify-between gap-4">
	            <span class="text-sm font-medium">Heading Color</span>
	            <Select.Root type="single" value={editor_settings.heading_color} onValueChange={handle_heading_color_change}>
	              <Select.Trigger class="w-32">
	                <span data-slot="select-value">
	                  {heading_color_options.find(o => o.value === editor_settings.heading_color)?.label}
	                </span>
	              </Select.Trigger>
	              <Select.Content>
	                {#each heading_color_options as option (option.value)}
	                  <Select.Item value={option.value}>{option.label}</Select.Item>
	                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </section>

	      <Separator />

	      <section class="flex flex-col gap-4">
	        <div class="flex items-center gap-2">
	          <LayoutIcon class="size-4 text-muted-foreground" />
	          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Layout</span>
	        </div>

        <div class="flex flex-col gap-5">
	          <div class="flex items-center justify-between gap-4">
	            <span class="text-sm font-medium">Content Spacing</span>
	            <Select.Root type="single" value={editor_settings.spacing} onValueChange={handle_spacing_change}>
	              <Select.Trigger class="w-32">
	                <span data-slot="select-value">
	                  {spacing_options.find(o => o.value === editor_settings.spacing)?.label}
	                </span>
	              </Select.Trigger>
	              <Select.Content>
	                {#each spacing_options as option (option.value)}
	                  <Select.Item value={option.value}>{option.label}</Select.Item>
	                {/each}
              </Select.Content>
            </Select.Root>
          </div>
        </div>
	      </section>

	      <Separator />

      <section class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <Link2Icon class="size-4 text-muted-foreground" />
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Links</span>
        </div>

	        <div class="flex flex-col gap-5">
	          <div class="flex items-center justify-between gap-4">
	            <span class="text-sm font-medium">Save Link Syntax</span>
	            <Select.Root
	              type="single"
	              value={editor_settings.link_syntax}
	              onValueChange={handle_link_syntax_change}
	            >
	              <Select.Trigger class="w-56">
	                <span data-slot="select-value">
	                  {link_syntax_options.find(o => o.value === editor_settings.link_syntax)?.label}
	                </span>
	              </Select.Trigger>
	              <Select.Content>
	                {#each link_syntax_options as option (option.value)}
	                  <Select.Item value={option.value}>{option.label}</Select.Item>
	                {/each}
	              </Select.Content>
	            </Select.Root>
          </div>
        </div>
      </section>

	      <Separator />

      <section class="flex flex-col gap-4">
        <div class="flex items-center gap-2">
          <FolderIcon class="size-4 text-muted-foreground" />
          <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">Files</span>
        </div>

        <div class="flex flex-col gap-5">
          <div class="flex items-center justify-between gap-4">
            <span class="text-sm font-medium">Attachment Folder</span>
            <Input
              type="text"
              value={editor_settings.attachment_folder}
              onchange={(e: Event & { currentTarget: HTMLInputElement }) => { handle_attachment_folder_change(e.currentTarget.value); }}
              oninput={(e: Event & { currentTarget: HTMLInputElement }) => { handle_attachment_folder_change(e.currentTarget.value); }}
              class="w-48"
              placeholder=".assets"
            />
          </div>
          <div class="flex items-center justify-between gap-4">
            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium">Show Hidden Files</span>
              <span class="text-xs text-muted-foreground">Show dot-prefixed files and folders in the file tree</span>
            </div>
            <Switch.Root
              checked={editor_settings.show_hidden_files}
              onCheckedChange={handle_show_hidden_files_change}
            />
          </div>
        </div>
      </section>

	    </div>

    <Dialog.Footer class="pt-4 border-t">
      {#if error}
        <span class="text-destructive text-sm mr-auto">{error}</span>
      {/if}
      <Button variant="outline" onclick={on_close}>Cancel</Button>
      <Button
        onclick={on_save}
        disabled={!has_unsaved_changes || is_saving}
      >
        {is_saving ? 'Saving...' : has_unsaved_changes ? 'Save Changes' : 'Saved'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
