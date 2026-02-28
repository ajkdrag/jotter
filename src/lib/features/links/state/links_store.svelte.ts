import type { NoteMeta } from "$lib/shared/types/note";
import type { OrphanLink } from "$lib/shared/types/search";
import type { ExternalLink } from "$lib/shared/types/link";

type LinksSnapshot = {
  backlinks: NoteMeta[];
  outlinks: NoteMeta[];
  orphan_links: OrphanLink[];
};

type LocalLinksSnapshot = {
  outlink_paths: string[];
  external_links: ExternalLink[];
};

export type LinksGlobalStatus = "idle" | "loading" | "ready" | "error";

export class LinksStore {
  local_outlink_paths = $state<string[]>([]);
  external_links = $state<ExternalLink[]>([]);

  backlinks = $state<NoteMeta[]>([]);
  outlinks = $state<NoteMeta[]>([]);
  orphan_links = $state<OrphanLink[]>([]);
  active_note_path = $state<string | null>(null);
  global_status = $state<LinksGlobalStatus>("idle");
  global_error = $state<string | null>(null);

  set_local_snapshot(note_path: string, snapshot: LocalLinksSnapshot) {
    this.active_note_path = note_path;
    this.local_outlink_paths = snapshot.outlink_paths;
    this.external_links = snapshot.external_links;
  }

  start_global_load(note_path: string) {
    this.active_note_path = note_path;
    this.global_status = "loading";
    this.global_error = null;
    this.backlinks = [];
    this.outlinks = [];
    this.orphan_links = [];
  }

  set_snapshot(note_path: string, snapshot: LinksSnapshot) {
    this.set_global_snapshot(note_path, snapshot);
  }

  set_global_snapshot(note_path: string, snapshot: LinksSnapshot) {
    this.active_note_path = note_path;
    this.global_status = "ready";
    this.global_error = null;
    this.backlinks = snapshot.backlinks;
    this.outlinks = snapshot.outlinks;
    this.orphan_links = snapshot.orphan_links;
  }

  set_global_error(note_path: string, error: string | null) {
    this.active_note_path = note_path;
    this.global_status = "error";
    this.global_error = error;
    this.backlinks = [];
    this.outlinks = [];
    this.orphan_links = [];
  }

  clear() {
    this.active_note_path = null;
    this.local_outlink_paths = [];
    this.external_links = [];
    this.backlinks = [];
    this.outlinks = [];
    this.orphan_links = [];
    this.global_status = "idle";
    this.global_error = null;
  }

  reset() {
    this.clear();
  }
}
