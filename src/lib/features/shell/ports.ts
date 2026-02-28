export interface ShellPort {
  open_url: (url: string) => Promise<void>;
}
