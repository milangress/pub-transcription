import type { Extension } from '@codemirror/state'
import { aiExtension } from '@marimo-team/codemirror-ai'
import { aiService } from './AIService'

/**
 * Creates a CodeMirror AI extension using the AIService
 * @returns A CodeMirror extension for AI-assisted editing
 */
export function createAIExtension(): Extension {
  return aiExtension({
    // Required: Function to generate completions
    prompt: async ({ prompt, selection, codeBefore, codeAfter }) => {
      try {
        // If no selection was made, we'll use some default prompt
        const actualPrompt = prompt || 'Improve this code'
        
        return await aiService.generateCompletion({
          prompt: actualPrompt,
          selection,
          codeBefore,
          codeAfter
        })
      } catch (error) {
        console.error('Error in AI extension:', error)
        return 'Error generating response. Please try again.'
      }
    },
    
    // Optional callbacks
    onAcceptEdit: (opts) => {
      console.log('Edit accepted', opts)
    },
    onRejectEdit: (opts) => {
      console.log('Edit rejected', opts)
    },
    onError: (error) => {
      console.error('AI extension error:', error)
    },
    
    // Optional configuration
    inputDebounceTime: 300, // ms
    keymaps: {
      showInput: 'Alt-a',  // Trigger AI edit with Alt+A
      acceptEdit: 'Alt-y', // Accept suggestion with Alt+Y
      rejectEdit: 'Alt-n'  // Reject suggestion with Alt+N
    }
  })
} 