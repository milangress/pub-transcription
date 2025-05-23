import { syntaxTree } from '@codemirror/language';
import { RangeSetBuilder, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type PluginValue,
  type ViewUpdate,
} from '@codemirror/view';
import type { ControllerSetting } from 'src/renderer/src/types';

// Global variable to store the current settings
let currentSettings: ControllerSetting[] = [];

// Widget to display computed values at the end of lines
class CompiledValueWidget extends WidgetType {
  value: string;
  constructor(value) {
    super();
    this.value = value;
  }

  eq(other: CompiledValueWidget): boolean {
    return other.value === this.value;
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'cm-compiled-value';
    span.style.cssText = `
      display: inline-block;
      color: #888;
      pointer-events: none;
      user-select: none;
      white-space: pre;
      padding-left: 1ch;
    `;
    span.textContent = `→ ${this.value}`;
    return span;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

// Helper to compute value from a binary expression node
function computeBinaryExpression(
  view: EditorView,
  node,
  settings: ControllerSetting[],
): string | null {
  if (!settings || !Array.isArray(settings) || settings.length === 0) return null;

  let varName: string | null = null;
  let operator: string | null = null;
  let number: number | null = null;
  let unit: string | null = null;

  // We need to find the children of this binary expression
  // We'll use syntaxTree.iterate for this specific node
  syntaxTree(view.state).iterate({
    from: node.from,
    to: node.to,
    enter: (childNode) => {
      const childName = childNode.type.name;
      const childText = view.state.doc.sliceString(childNode.from, childNode.to);
      if (childName === 'SassVariableName') {
        varName = childText.substring(1); // Remove the $ prefix
      } else if (childName === 'BinOp') {
        operator = childText.trim();
      } else if (childName === 'NumberLiteral') {
        // Extract the number and unit if present
        const match = childText.match(/^([\d.]+)([a-z%]*)$/);
        if (match) {
          number = parseFloat(match[1]);
          unit = match[2] || '';
        } else {
          number = parseFloat(childText);
          unit = '';
        }
      }

      // Continue iteration for all nodes
      return true;
    },
  });

  // Find the setting for this variable
  const setting = settings.find((s) => s.var === varName);
  if (!setting) return null;

  if (!number || !operator || !varName) {
    console.error('missing number, operator, or varName', number, operator, varName);
    return null;
  }
  // Compute the result based on the operator
  let result;
  switch (operator) {
    case '+':
      result = setting.value + number;
      break;
    case '-':
      result = setting.value - number;
      break;
    case '*':
      result = setting.value * number;
      break;
    case '/':
      result = setting.value / number;
      break;
    default:
      return null;
  }

  const roundedResult = parseFloat(result.toFixed(3));

  // Return the formatted result with the unit if present
  return unit ? `${roundedResult}${unit}` : roundedResult.toString();
}

// Theme for styling the compiled values
const compiledValueTheme = EditorView.theme({
  '.cm-compiled-value': {
    opacity: 0.7,
  },
});

export function updateControllerValues(settings: ControllerSetting[]): void {
  currentSettings = settings;
}

// Extension for displaying compiled controller values
export function compiledControllerValues(initialSettings: ControllerSetting[] = []): Extension {
  // Initialize global settings
  currentSettings = initialSettings;

  // Create the view plugin
  const plugin = ViewPlugin.fromClass(
    class implements PluginValue {
      decos: DecorationSet;
      debounceTimer: number | null = null;

      constructor(view: EditorView) {
        this.decos = this.computeDecorations(view);
      }

      // Helper to compute all decorations at once
      computeDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();

        // Keep track of values per line
        const lineValues = new Map<number, string[]>();

        // Process visible lines for performance
        for (const { from, to } of view.visibleRanges) {
          syntaxTree(view.state).iterate({
            from,
            to,
            enter: (node) => {
              // Skip if not a binary expression with a SASS variable
              if (node.type.name !== 'BinaryExpression') return;

              // Find the line containing this expression
              const line = view.state.doc.lineAt(node.from);

              // Compute the value of this expression
              const value = computeBinaryExpression(view, node, currentSettings);

              if (value !== null) {
                // Add this value to the line's collection
                if (!lineValues.has(line.number)) {
                  lineValues.set(line.number, []);
                }
                lineValues.get(line.number)!.push(value);
              }
            },
          });
        }

        // Create decorations for each line
        for (const [lineNumber, values] of lineValues.entries()) {
          if (values.length > 0) {
            // Get the line
            const line = view.state.doc.line(lineNumber);
            // Join all values with commas
            const combinedValue = values.join(', ');
            const widget = new CompiledValueWidget(combinedValue);
            builder.add(
              line.to,
              line.to,
              Decoration.widget({
                widget,
                side: 1,
              }),
            );
          }
        }

        return builder.finish();
      }

      update(update: ViewUpdate): void {
        this.decos = this.computeDecorations(update.view);
      }
    },
    {
      decorations: (v) => v.decos,
    },
  );

  return [compiledValueTheme, plugin];
}
