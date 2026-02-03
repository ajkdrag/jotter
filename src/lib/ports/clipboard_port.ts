export type ClipboardPort = {
  write_text: (text: string) => Promise<void>
}

