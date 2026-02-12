<script lang="ts">
  import { Files, Settings, Star } from "@lucide/svelte";

  type SidebarView = "explorer" | "starred";

  type Props = {
    sidebar_open: boolean;
    active_view: SidebarView;
    on_open_explorer: () => void;
    on_open_starred: () => void;
    on_open_settings: () => void;
  };

  let {
    sidebar_open,
    active_view,
    on_open_explorer,
    on_open_starred,
    on_open_settings,
  }: Props = $props();
</script>

<div class="ActivityBar">
  <div class="ActivityBar__section">
    <button
      type="button"
      class="ActivityBar__button"
      class:ActivityBar__button--active={sidebar_open &&
        active_view === "explorer"}
      onclick={on_open_explorer}
      aria-pressed={sidebar_open && active_view === "explorer"}
      aria-label="Explorer"
    >
      <Files class="ActivityBar__icon" />
    </button>

    <button
      type="button"
      class="ActivityBar__button"
      class:ActivityBar__button--active={sidebar_open &&
        active_view === "starred"}
      onclick={on_open_starred}
      aria-pressed={sidebar_open && active_view === "starred"}
      aria-label="Starred"
    >
      <Star class="ActivityBar__icon" />
    </button>
  </div>

  <div class="ActivityBar__section">
    <button
      type="button"
      class="ActivityBar__button"
      onclick={on_open_settings}
      aria-label="Settings"
    >
      <Settings class="ActivityBar__icon" />
    </button>
  </div>
</div>

<style>
  .ActivityBar {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    width: var(--size-activity-bar);
    height: 100%;
    padding-block: var(--space-1);
    background-color: var(--sidebar);
    border-inline-end: 1px solid var(--sidebar-border);
  }

  .ActivityBar__section {
    display: flex;
    flex-direction: column;
  }

  .ActivityBar__button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-activity-bar);
    height: var(--size-activity-bar);
    color: var(--sidebar-foreground);
    opacity: 0.7;
    transition:
      opacity var(--duration-fast) var(--ease-default),
      background-color var(--duration-fast) var(--ease-default);
  }

  .ActivityBar__button:hover {
    opacity: 1;
    background-color: var(--sidebar-accent);
  }

  .ActivityBar__button:focus-visible {
    opacity: 1;
    outline: 2px solid var(--focus-ring);
    outline-offset: -2px;
  }

  .ActivityBar__button--active {
    opacity: 1;
    background-color: var(--interactive-bg);
    color: var(--interactive);
  }

  .ActivityBar__button--active::before {
    content: "";
    position: absolute;
    inset-block: var(--space-2);
    inset-inline-start: 0;
    width: 2px;
    background-color: var(--interactive);
    border-radius: 1px;
  }

  :global(.ActivityBar__icon) {
    width: var(--size-activity-icon);
    height: var(--size-activity-icon);
  }
</style>
