import { readdirSync } from "fs";
import { resolve } from "path";
import { error } from "@sveltejs/kit";

export function GET() {
  try {
    const test_files_dir = resolve(process.cwd(), "test", "files");
    const files = readdirSync(test_files_dir)
      .filter((file) => file.endsWith(".md"))
      .sort();

    return new Response(JSON.stringify(files), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    error(500, e instanceof Error ? e.message : "Failed to list test files");
  }
}
