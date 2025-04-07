import type { Extension } from '@codemirror/state';
import { StateEffect } from '@codemirror/state';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';

// Define an effect that can be dispatched to mark lines for flashing
export const flashLinesEffect = StateEffect.define<{ startLine: number; endLine: number }>();

// The styling for the flash effect
const flashTheme = EditorView.baseTheme({
  '&light .cm-flash-highlight': {
    backgroundColor: '#a6e22e33',
    animation: 'cm-flash 0.8s ease-out',
  },
  '&dark .cm-flash-highlight': {
    backgroundColor: '#a6e22e33',
    animation: 'cm-flash 0.8s ease-out',
  },
  '@keyframes cm-flash': {
    '0%': { backgroundColor: '#a6e22ecc' },
    '100%': { backgroundColor: '#a6e22e00' },
  },
});

// Decoration for highlighting the flashed lines
const flashHighlight = Decoration.line({
  attributes: { class: 'cm-flash-highlight' },
});

// Create decorations for the lines to be flashed
function createFlashDecorations(
  view: EditorView,
  startLine: number,
  endLine: number,
): DecorationSet {
  const builder = Decoration.set([]);
  let decorations = builder;

  for (let i = startLine; i <= endLine; i++) {
    const line = view.state.doc.line(i);
    decorations = decorations.update({
      add: [flashHighlight.range(line.from)],
    });
  }

  return decorations;
}

// Plugin that manages flash decorations
const flashPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet = Decoration.none;

    constructor() {
      this.decorations = Decoration.none;
    }

    update(update: ViewUpdate): void {
      // Map decorations through document changes
      if (update.docChanged) {
        this.decorations = this.decorations.map(update.changes);
      }

      // Look for flash effects and apply them
      for (const tr of update.transactions) {
        for (const effect of tr.effects) {
          if (effect.is(flashLinesEffect)) {
            const { startLine, endLine } = effect.value;
            this.decorations = createFlashDecorations(update.view, startLine, endLine);

            // Clear decorations after a delay
            setTimeout(() => {
              if (update.view) {
                update.view.dispatch({
                  effects: StateEffect.appendConfig.of([]),
                });
                this.decorations = Decoration.none;
              }
            }, 800);
          }
        }
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

// Export the flash effect extension
export function flashEffect(): Extension[] {
  return [flashTheme, flashPlugin];
}
