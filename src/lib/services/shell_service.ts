import type { ShellPort } from "$lib/ports/shell_port";
import { create_logger } from "$lib/utils/logger";

const log = create_logger("shell_service");

export class ShellService {
  constructor(private readonly shell_port: ShellPort) {}

  async open_url(url: string): Promise<void> {
    try {
      await this.shell_port.open_url(url);
    } catch (error) {
      log.error("Open URL failed", { error });
    }
  }
}
