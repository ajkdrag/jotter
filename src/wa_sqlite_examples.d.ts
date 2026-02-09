declare module "@journeyapps/wa-sqlite/src/examples/IDBBatchAtomicVFS.js" {
  export class IDBBatchAtomicVFS {
    static create(
      name: string,
      module: unknown,
      options?: unknown,
    ): Promise<IDBBatchAtomicVFS>;
    constructor(name?: string, options?: unknown);
    name: string;
    close?: () => Promise<void> | void;
  }
}

declare module "@journeyapps/wa-sqlite/src/examples/MemoryAsyncVFS.js" {
  export class MemoryAsyncVFS {
    static create(name: string, module: unknown): Promise<MemoryAsyncVFS>;
    constructor(name: string, module: unknown);
    name: string;
    close?: () => Promise<void> | void;
  }
}

declare module "@journeyapps/wa-sqlite/src/examples/OPFSAdaptiveVFS.js" {
  export class OPFSAdaptiveVFS {
    static create(name: string, module: unknown): Promise<OPFSAdaptiveVFS>;
    name: string;
    close?: () => Promise<void> | void;
  }
}
