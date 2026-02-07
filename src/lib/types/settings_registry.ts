import type { EditorSettings } from '$lib/types/editor_settings'

export type SettingDefinition = {
  key: keyof EditorSettings
  label: string
  description: string
  category: string
  keywords: string[]
}

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  {
    key: 'font_size',
    label: 'Font Size',
    description: 'Adjust the editor font size',
    category: 'Typography',
    keywords: ['text', 'size', 'font', 'bigger', 'smaller', 'large', 'small']
  },
  {
    key: 'line_height',
    label: 'Line Height',
    description: 'Adjust spacing between lines',
    category: 'Typography',
    keywords: ['spacing', 'lines', 'height', 'leading', 'paragraph']
  },
  {
    key: 'heading_color',
    label: 'Heading Color',
    description: 'Set the color scheme for headings',
    category: 'Typography',
    keywords: ['headings', 'color', 'h1', 'h2', 'h3', 'title', 'headers']
  },
  {
    key: 'spacing',
    label: 'Content Spacing',
    description: 'Set the overall content spacing',
    category: 'Layout',
    keywords: ['compact', 'normal', 'spacious', 'padding', 'margins', 'density']
  },
  {
    key: 'link_syntax',
    label: 'Link Syntax',
    description: 'Choose between wikilinks or markdown links',
    category: 'Links',
    keywords: ['wiki', 'wikilink', 'markdown', 'link', 'format', 'syntax', 'brackets']
  },
  {
    key: 'attachment_folder',
    label: 'Attachment Folder',
    description: 'Folder name for storing pasted images and attachments',
    category: 'Files',
    keywords: ['assets', 'images', 'attachments', 'folder', 'path', 'upload', 'paste']
  }
]
