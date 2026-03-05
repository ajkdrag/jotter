export class TerminalStore {
  panel_open = $state(false);

  toggle() {
    this.panel_open = !this.panel_open;
  }

  open() {
    this.panel_open = true;
  }

  close() {
    this.panel_open = false;
  }

  reset() {
    this.panel_open = false;
  }
}
