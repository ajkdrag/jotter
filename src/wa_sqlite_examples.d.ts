declare module "wa-sqlite/src/examples/IDBBatchAtomicVFS.js" {
  export class IDBBatchAtomicVFS {
    constructor(name?: string, options?: unknown);
    name: string;
    close?: () => Promise<void> | void;
  }
}

declare module "wa-sqlite/src/examples/OriginPrivateFileSystemVFS.js" {
  export class OriginPrivateFileSystemVFS {
    constructor();
    name: string;
    close?: () => Promise<void> | void;
  }
}
