import type { Extension } from '@codemirror/state'

// CodeMirror AI Extension Types
declare module '@marimo-team/codemirror-ai' {
  interface AIEditOptions {
    prompt: string
    selection: string
    codeBefore: string
    codeAfter: string
    result: string
  }

  interface AIExtensionOptions {
    prompt: (options: { 
      prompt: string
      selection: string
      codeBefore: string
      codeAfter: string 
    }) => Promise<string>
    onAcceptEdit?: (options: AIEditOptions) => void
    onRejectEdit?: (options: AIEditOptions) => void
    onError?: (error: Error) => void
    inputDebounceTime?: number
    keymaps?: {
      showInput: string
      acceptEdit: string
      rejectEdit: string
    }
  }
  
  export function aiExtension(options: AIExtensionOptions): Extension
} 