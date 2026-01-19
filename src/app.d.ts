declare global {
  namespace App {}
}

declare module '@typescript-eslint/types' {
  export namespace TSESTree {
    export type Node = unknown
  }
}

export {}
