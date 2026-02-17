import type { NoteMeta } from "$lib/types/note";
import type { OrphanLink } from "$lib/types/search";

type LinksSnapshot = {
  backlinks: NoteMeta[];
  outlinks: NoteMeta[];
  orphan_links: OrphanLink[];
};

export class LinksStore {
  backlinks = $state<NoteMeta[]>([]);
  outlinks = $state<NoteMeta[]>([]);
  orphan_links = $state<OrphanLink[]>([]);
  active_note_path = $state<string | null>(null);

  set_snapshot(note_path: string, snapshot: LinksSnapshot) {
    this.active_note_path = note_path;
    this.backlinks = snapshot.backlinks;
    this.outlinks = snapshot.outlinks;
    this.orphan_links = snapshot.orphan_links;
  }

  clear() {
    this.active_note_path = null;
    this.backlinks = [];
    this.outlinks = [];
    this.orphan_links = [];
  }

  reset() {
    this.clear();
  }
}
