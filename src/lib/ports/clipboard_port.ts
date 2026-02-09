export interface ClipboardPort {
  write_text: (text: string) => Promise<void>;
}
