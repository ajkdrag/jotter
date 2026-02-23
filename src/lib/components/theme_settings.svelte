<script lang="ts">
  import * as Select from "$lib/components/ui/select/index.js";
  import * as Slider from "$lib/components/ui/slider/index.js";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import Copy from "@lucide/svelte/icons/copy";
  import Plus from "@lucide/svelte/icons/plus";
  import RotateCcw from "@lucide/svelte/icons/rotate-ccw";
  import type { Theme } from "$lib/types/theme";
  import { get_all_themes } from "$lib/types/theme";
  import {
    parse_hsl,
    format_hsl,
    SANS_FONT_OPTIONS,
    MONO_FONT_OPTIONS,
    COLOR_PRESETS,
  } from "$lib/utils/theme_helpers";

  type Props = {
    user_themes: Theme[];
    active_theme: Theme;
    on_switch: (theme_id: string) => void;
    on_create: (name: string, base: Theme) => void;
    on_duplicate: (theme_id: string) => void;
    on_rename: (id: string, name: string) => void;
    on_delete: (theme_id: string) => void;
    on_update: (theme: Theme) => void;
  };

  let {
    user_themes,
    active_theme,
    on_switch,
    on_create,
    on_duplicate,
    on_rename,
    on_delete,
    on_update,
  }: Props = $props();

  const all_themes = $derived(get_all_themes(user_themes));
  const locked = $derived(active_theme.is_builtin);

  let accent_hue = $derived(active_theme.accent_hue);
  let accent_chroma = $derived(active_theme.accent_chroma);
  let font_size = $derived(active_theme.font_size);
  let line_height = $derived(active_theme.line_height);
  let heading_font_weight = $derived(active_theme.heading_font_weight);

  function update<K extends keyof Theme>(key: K, value: Theme[K]) {
    if (locked) return;
    on_update({ ...active_theme, [key]: value });
  }

  function update_select<K extends keyof Theme>(
    key: K,
    value: string | undefined,
  ) {
    if (value && !locked) {
      on_update({ ...active_theme, [key]: value });
    }
  }

  function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, Math.round(v)));
  }

  const accent_preview_style = $derived(
    `background: oklch(0.55 ${active_theme.accent_chroma} ${active_theme.accent_hue})`,
  );

  const color_scheme_options = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
  ];

  const spacing_options = [
    { value: "compact", label: "Compact" },
    { value: "normal", label: "Normal" },
    { value: "spacious", label: "Spacious" },
  ];

  const heading_color_options = [
    { value: "inherit", label: "Inherit" },
    { value: "primary", label: "Primary" },
    { value: "accent", label: "Accent" },
  ];

  const bold_style_options = [
    { value: "default", label: "Default (600)" },
    { value: "heavier", label: "Heavy (700)" },
    { value: "color-accent", label: "Accent Color" },
  ];

  const blockquote_style_options = [
    { value: "default", label: "Default" },
    { value: "minimal", label: "Minimal (no bg)" },
    { value: "accent-bar", label: "Accent Bar" },
  ];

  const code_block_style_options = [
    { value: "default", label: "Default" },
    { value: "borderless", label: "Borderless" },
    { value: "filled", label: "Filled" },
  ];

  let new_theme_name = $state("");
  let show_create = $state(false);

  function handle_create() {
    const name = new_theme_name.trim();
    if (!name) return;
    on_create(name, active_theme);
    new_theme_name = "";
    show_create = false;
  }
</script>

{#snippet color_field(
  label: string,
  key: keyof Theme,
  current_value: string | null,
)}
  {@const parsed = parse_hsl(current_value)}
  <div class="ColorField">
    <div class="ColorField__header">
      <div class="ColorField__header-left">
        <span class="ColorField__label">{label}</span>
        {#if current_value}
          <button
            type="button"
            class="ColorField__reset"
            onclick={() => update(key, null as never)}
            disabled={locked}
            title="Reset to default"
          >
            <RotateCcw />
          </button>
        {/if}
      </div>
      <div class="ColorField__header-right">
        <span class="ColorField__channel-label ColorField__channel-label--pad"
        ></span>
        <span class="ColorField__channel-label">H</span>
        <span class="ColorField__channel-label">S</span>
        <span class="ColorField__channel-label">L</span>
      </div>
    </div>
    <div class="ColorField__body">
      <div class="ColorField__swatches">
        {#each COLOR_PRESETS as preset (preset.value)}
          <button
            type="button"
            class="ColorField__swatch"
            class:ColorField__swatch--active={current_value === preset.value}
            style="background: {preset.value}"
            title={preset.label}
            onclick={() => update(key, preset.value as never)}
            disabled={locked}
          ></button>
        {/each}
      </div>
      <div class="ColorField__hsl">
        <span
          class="ColorField__preview"
          style="background: {current_value ?? 'var(--muted)'}"
        ></span>
        <Input
          type="number"
          value={parsed ? String(parsed.h) : ""}
          placeholder="—"
          min={0}
          max={360}
          onchange={(e: Event & { currentTarget: HTMLInputElement }) => {
            const h = clamp(Number(e.currentTarget.value) || 0, 0, 360);
            const base = parsed ?? { h: 0, s: 0, l: 50 };
            update(key, format_hsl({ ...base, h }) as never);
          }}
          class="ColorField__channel-input"
          disabled={locked}
        />
        <Input
          type="number"
          value={parsed ? String(parsed.s) : ""}
          placeholder="—"
          min={0}
          max={100}
          onchange={(e: Event & { currentTarget: HTMLInputElement }) => {
            const s = clamp(Number(e.currentTarget.value) || 0, 0, 100);
            const base = parsed ?? { h: 0, s: 0, l: 50 };
            update(key, format_hsl({ ...base, s }) as never);
          }}
          class="ColorField__channel-input"
          disabled={locked}
        />
        <Input
          type="number"
          value={parsed ? String(parsed.l) : ""}
          placeholder="—"
          min={0}
          max={100}
          onchange={(e: Event & { currentTarget: HTMLInputElement }) => {
            const l = clamp(Number(e.currentTarget.value) || 0, 0, 100);
            const base = parsed ?? { h: 0, s: 0, l: 50 };
            update(key, format_hsl({ ...base, l }) as never);
          }}
          class="ColorField__channel-input"
          disabled={locked}
        />
      </div>
    </div>
  </div>
{/snippet}

<div class="ThemeSettings">
  <!-- ─── Profile Bar ─── -->
  <div class="ThemeSettings__profile-bar">
    <Select.Root
      type="single"
      value={active_theme.id}
      onValueChange={(v: string | undefined) => {
        if (v) on_switch(v);
      }}
    >
      <Select.Trigger class="ThemeSettings__theme-select">
        <span data-slot="select-value">{active_theme.name}</span>
      </Select.Trigger>
      <Select.Content>
        {#each all_themes as theme (theme.id)}
          <Select.Item value={theme.id}>{theme.name}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>

    <div class="ThemeSettings__profile-actions">
      <Button
        variant="ghost"
        size="icon"
        onclick={() => on_duplicate(active_theme.id)}
        aria-label="Duplicate theme"
      >
        <Copy />
      </Button>
      {#if !locked}
        <Button
          variant="ghost"
          size="icon"
          onclick={() => on_delete(active_theme.id)}
          aria-label="Delete theme"
        >
          <Trash2 />
        </Button>
      {/if}
      <Button
        variant="ghost"
        size="icon"
        onclick={() => {
          show_create = !show_create;
        }}
        aria-label="New theme"
      >
        <Plus />
      </Button>
    </div>
  </div>

  {#if show_create}
    <div class="ThemeSettings__create-row">
      <Input
        type="text"
        bind:value={new_theme_name}
        placeholder="Theme name..."
        class="flex-1"
        onkeydown={(e: KeyboardEvent) => {
          if (e.key === "Enter") handle_create();
        }}
      />
      <Button
        size="sm"
        onclick={handle_create}
        disabled={!new_theme_name.trim()}
      >
        Create
      </Button>
    </div>
  {/if}

  {#if !locked}
    <div class="ThemeSettings__row" style="margin-bottom: var(--space-2)">
      <span class="ThemeSettings__label">Name</span>
      <Input
        type="text"
        value={active_theme.name}
        onchange={(e: Event & { currentTarget: HTMLInputElement }) => {
          on_rename(active_theme.id, e.currentTarget.value);
        }}
        class="w-48"
      />
    </div>
  {/if}

  {#if locked}
    <p class="ThemeSettings__hint">Duplicate this theme to customize it.</p>
  {/if}

  <!-- ═══ Interface ═══ -->
  <div class="ThemeSettings__section-header">Interface</div>

  <div class="ThemeSettings__section-content">
    <div class="ThemeSettings__row">
      <span class="ThemeSettings__label">Base</span>
      <Select.Root
        type="single"
        value={active_theme.color_scheme}
        onValueChange={(v: string | undefined) =>
          update_select("color_scheme", v)}
        disabled={locked}
      >
        <Select.Trigger class="w-28">
          <span data-slot="select-value">
            {color_scheme_options.find(
              (o) => o.value === active_theme.color_scheme,
            )?.label}
          </span>
        </Select.Trigger>
        <Select.Content>
          {#each color_scheme_options as option (option.value)}
            <Select.Item value={option.value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="ThemeSettings__row">
      <span class="ThemeSettings__label">Sans Font</span>
      <Select.Root
        type="single"
        value={active_theme.font_family_sans}
        onValueChange={(v: string | undefined) =>
          update_select("font_family_sans", v)}
        disabled={locked}
      >
        <Select.Trigger class="w-44">
          <span data-slot="select-value">{active_theme.font_family_sans}</span>
        </Select.Trigger>
        <Select.Content>
          {#each SANS_FONT_OPTIONS as opt (opt.value)}
            <Select.Item value={opt.value}>{opt.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="ThemeSettings__row">
      <span class="ThemeSettings__label">Mono Font</span>
      <Select.Root
        type="single"
        value={active_theme.font_family_mono}
        onValueChange={(v: string | undefined) =>
          update_select("font_family_mono", v)}
        disabled={locked}
      >
        <Select.Trigger class="w-44">
          <span data-slot="select-value">{active_theme.font_family_mono}</span>
        </Select.Trigger>
        <Select.Content>
          {#each MONO_FONT_OPTIONS as opt (opt.value)}
            <Select.Item value={opt.value}>{opt.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="ThemeSettings__row--stacked">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class="ThemeSettings__label">Accent Color</span>
          <span class="ThemeSettings__color-dot" style={accent_preview_style}
          ></span>
        </div>
        <span class="ThemeSettings__badge">{active_theme.accent_hue}°</span>
      </div>
      <Slider.Root
        type="single"
        value={accent_hue}
        onValueChange={(v: number) => update("accent_hue", Math.round(v))}
        min={0}
        max={360}
        step={1}
        class="w-full"
        disabled={locked}
      />
    </div>

    <div class="ThemeSettings__row--stacked">
      <div class="flex items-center justify-between">
        <span class="ThemeSettings__label">Color Intensity</span>
        <span class="ThemeSettings__badge"
          >{active_theme.accent_chroma.toFixed(2)}</span
        >
      </div>
      <Slider.Root
        type="single"
        value={accent_chroma}
        onValueChange={(v: number) =>
          update("accent_chroma", Math.round(v * 100) / 100)}
        min={0.02}
        max={0.3}
        step={0.01}
        class="w-full"
        disabled={locked}
      />
    </div>
  </div>

  <!-- ═══ Typography ═══ -->
  <div class="ThemeSettings__section-header">Typography</div>

  <div class="ThemeSettings__section-content">
    <div class="ThemeSettings__row--stacked">
      <div class="flex items-center justify-between">
        <span class="ThemeSettings__label">Font Size</span>
        <span class="ThemeSettings__badge"
          >{active_theme.font_size.toFixed(2)}rem</span
        >
      </div>
      <Slider.Root
        type="single"
        value={font_size}
        onValueChange={(v: number) => update("font_size", v)}
        min={0.875}
        max={1.25}
        step={0.0625}
        class="w-full"
        disabled={locked}
      />
    </div>

    <div class="ThemeSettings__row--stacked">
      <div class="flex items-center justify-between">
        <span class="ThemeSettings__label">Line Height</span>
        <span class="ThemeSettings__badge"
          >{active_theme.line_height.toFixed(2)}</span
        >
      </div>
      <Slider.Root
        type="single"
        value={line_height}
        onValueChange={(v: number) => update("line_height", v)}
        min={1.5}
        max={2.0}
        step={0.05}
        class="w-full"
        disabled={locked}
      />
    </div>

    <div class="ThemeSettings__row">
      <span class="ThemeSettings__label">Content Spacing</span>
      <Select.Root
        type="single"
        value={active_theme.spacing}
        onValueChange={(v: string | undefined) => update_select("spacing", v)}
        disabled={locked}
      >
        <Select.Trigger class="w-32">
          <span data-slot="select-value">
            {spacing_options.find((o) => o.value === active_theme.spacing)
              ?.label}
          </span>
        </Select.Trigger>
        <Select.Content>
          {#each spacing_options as option (option.value)}
            <Select.Item value={option.value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    {@render color_field(
      "Body Text",
      "editor_text_color",
      active_theme.editor_text_color,
    )}
    {@render color_field("Links", "link_color", active_theme.link_color)}
  </div>

  <!-- ═══ Headings ═══ -->
  <div class="ThemeSettings__section-header">Headings</div>

  <div class="ThemeSettings__section-content">
    <div class="ThemeSettings__row">
      <span class="ThemeSettings__label">Color</span>
      <Select.Root
        type="single"
        value={active_theme.heading_color}
        onValueChange={(v: string | undefined) =>
          update_select("heading_color", v)}
        disabled={locked}
      >
        <Select.Trigger class="w-28">
          <span data-slot="select-value">
            {heading_color_options.find(
              (o) => o.value === active_theme.heading_color,
            )?.label}
          </span>
        </Select.Trigger>
        <Select.Content>
          {#each heading_color_options as option (option.value)}
            <Select.Item value={option.value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    <div class="ThemeSettings__row--stacked">
      <div class="flex items-center justify-between">
        <span class="ThemeSettings__label">Weight</span>
        <span class="ThemeSettings__badge"
          >{active_theme.heading_font_weight}</span
        >
      </div>
      <Slider.Root
        type="single"
        value={heading_font_weight}
        onValueChange={(v: number) =>
          update("heading_font_weight", Math.round(v / 100) * 100)}
        min={300}
        max={700}
        step={100}
        class="w-full"
        disabled={locked}
      />
    </div>
  </div>

  <!-- ═══ Bold & Italic ═══ -->
  <div class="ThemeSettings__section-header">Bold & Italic</div>

  <div class="ThemeSettings__section-content">
    <div class="ThemeSettings__row">
      <span class="ThemeSettings__label">Bold Style</span>
      <Select.Root
        type="single"
        value={active_theme.bold_style}
        onValueChange={(v: string | undefined) =>
          update_select("bold_style", v)}
        disabled={locked}
      >
        <Select.Trigger class="w-40">
          <span data-slot="select-value">
            {bold_style_options.find((o) => o.value === active_theme.bold_style)
              ?.label}
          </span>
        </Select.Trigger>
        <Select.Content>
          {#each bold_style_options as option (option.value)}
            <Select.Item value={option.value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    {@render color_field("Bold Color", "bold_color", active_theme.bold_color)}
    {@render color_field(
      "Italic Color",
      "italic_color",
      active_theme.italic_color,
    )}
  </div>

  <!-- ═══ Blockquotes ═══ -->
  <div class="ThemeSettings__section-header">Blockquotes</div>

  <div class="ThemeSettings__section-content">
    <div class="ThemeSettings__row">
      <span class="ThemeSettings__label">Style</span>
      <Select.Root
        type="single"
        value={active_theme.blockquote_style}
        onValueChange={(v: string | undefined) =>
          update_select("blockquote_style", v)}
        disabled={locked}
      >
        <Select.Trigger class="w-40">
          <span data-slot="select-value">
            {blockquote_style_options.find(
              (o) => o.value === active_theme.blockquote_style,
            )?.label}
          </span>
        </Select.Trigger>
        <Select.Content>
          {#each blockquote_style_options as option (option.value)}
            <Select.Item value={option.value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    {@render color_field(
      "Border",
      "blockquote_border_color",
      active_theme.blockquote_border_color,
    )}
    {@render color_field(
      "Text",
      "blockquote_text_color",
      active_theme.blockquote_text_color,
    )}
  </div>

  <!-- ═══ Inline Code ═══ -->
  <div class="ThemeSettings__section-header">Inline Code</div>

  <div class="ThemeSettings__section-content">
    {@render color_field(
      "Background",
      "inline_code_bg",
      active_theme.inline_code_bg,
    )}
    {@render color_field(
      "Text",
      "inline_code_text_color",
      active_theme.inline_code_text_color,
    )}
  </div>

  <!-- ═══ Code Blocks ═══ -->
  <div class="ThemeSettings__section-header">Code Blocks</div>

  <div class="ThemeSettings__section-content">
    <div class="ThemeSettings__row">
      <span class="ThemeSettings__label">Style</span>
      <Select.Root
        type="single"
        value={active_theme.code_block_style}
        onValueChange={(v: string | undefined) =>
          update_select("code_block_style", v)}
        disabled={locked}
      >
        <Select.Trigger class="w-40">
          <span data-slot="select-value">
            {code_block_style_options.find(
              (o) => o.value === active_theme.code_block_style,
            )?.label}
          </span>
        </Select.Trigger>
        <Select.Content>
          {#each code_block_style_options as option (option.value)}
            <Select.Item value={option.value}>{option.label}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>

    {@render color_field(
      "Background",
      "code_block_bg",
      active_theme.code_block_bg,
    )}
    {@render color_field(
      "Text",
      "code_block_text_color",
      active_theme.code_block_text_color,
    )}
  </div>

  <!-- ═══ Highlights ═══ -->
  <div class="ThemeSettings__section-header">Highlights</div>

  <div class="ThemeSettings__section-content">
    {@render color_field(
      "Background",
      "highlight_bg",
      active_theme.highlight_bg,
    )}
    {@render color_field(
      "Text",
      "highlight_text_color",
      active_theme.highlight_text_color,
    )}
  </div>
</div>

<style>
  .ThemeSettings {
    display: flex;
    flex-direction: column;
  }

  .ThemeSettings__profile-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }

  :global(.ThemeSettings__theme-select) {
    min-width: 10rem;
  }

  .ThemeSettings__profile-actions {
    display: flex;
    gap: var(--space-1);
  }

  .ThemeSettings__create-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-bottom: var(--space-5);
  }

  .ThemeSettings__section-header {
    font-size: var(--text-xs);
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted-foreground);
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--border);
    margin-top: var(--space-6);
    margin-bottom: var(--space-4);
  }

  .ThemeSettings__section-header:first-of-type {
    margin-top: var(--space-4);
  }

  .ThemeSettings__section-content {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .ThemeSettings__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .ThemeSettings__row--stacked {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .ThemeSettings__label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--foreground);
    white-space: nowrap;
  }

  .ThemeSettings__badge {
    font-size: var(--text-xs);
    font-family: var(--font-mono, ui-monospace, monospace);
    color: var(--muted-foreground);
    background-color: var(--muted);
    padding: var(--space-0-5) var(--space-2);
    border-radius: var(--radius-sm);
  }

  .ThemeSettings__color-dot {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid var(--border);
    flex-shrink: 0;
  }

  .ThemeSettings__hint {
    font-size: var(--text-xs);
    color: var(--muted-foreground);
    font-style: italic;
    padding: var(--space-2) var(--space-3);
    background: var(--muted);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-2);
  }

  /* ─── Color Field ─── */

  .ColorField {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .ColorField__header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-4);
  }

  .ColorField__header-left {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex: 1;
    min-width: 0;
  }

  .ColorField__header-right {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    flex-shrink: 0;
  }

  .ColorField__label {
    font-size: var(--text-sm);
    font-weight: 500;
    color: var(--foreground);
  }

  .ColorField__reset {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    border-radius: var(--radius-sm);
    color: var(--muted-foreground);
    opacity: 0.5;
    transition: all var(--duration-fast) var(--ease-default);
  }

  .ColorField__reset:hover:not(:disabled) {
    opacity: 1;
    color: var(--destructive);
  }

  :global(.ColorField__reset svg) {
    width: 11px;
    height: 11px;
  }

  .ColorField__body {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  .ColorField__swatches {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    flex: 1;
    min-width: 0;
    align-content: flex-start;
  }

  .ColorField__swatch {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-default);
    flex-shrink: 0;
  }

  .ColorField__swatch:hover:not(:disabled) {
    border-color: var(--muted-foreground);
    transform: scale(1.15);
  }

  .ColorField__swatch--active {
    border-color: var(--interactive);
    box-shadow: 0 0 0 1px var(--interactive);
  }

  .ColorField__swatch:disabled {
    opacity: 0.3;
    cursor: default;
  }

  .ColorField__hsl {
    display: flex;
    align-items: center;
    gap: var(--space-1-5);
    flex-shrink: 0;
  }

  .ColorField__preview {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 2px solid var(--border);
    flex-shrink: 0;
  }

  .ColorField__channel-label {
    font-size: 9px;
    font-weight: 600;
    color: var(--muted-foreground);
    text-transform: uppercase;
    line-height: 1;
    width: 2.75rem;
    text-align: center;
  }

  .ColorField__channel-label--pad {
    width: 20px;
  }

  :global(.ColorField__channel-input) {
    width: 2.75rem !important;
    height: 20px !important;
    font-size: var(--text-xs) !important;
    font-family: var(--font-mono, ui-monospace, monospace) !important;
    text-align: center !important;
    padding: 0 var(--space-1) !important;
  }

  :global(.ColorField__channel-input::-webkit-inner-spin-button),
  :global(.ColorField__channel-input::-webkit-outer-spin-button) {
    -webkit-appearance: none;
    margin: 0;
  }
</style>
