import type { ShellPort } from "$lib/ports/shell_port";
import { logger } from "$lib/utils/logger";

export class ShellService {
  constructor(private readonly shell_port: ShellPort) {}

  async open_url(url: string): Promise<void> {
    try {
      await this.shell_port.open_url(url);
    } catch (error) {
      logger.error(`Open URL failed: ${String(error)}`);
    }
  }
}
