import type { TxtObject } from 'src/renderer/src/types';
import type { SvelteComponent } from 'svelte';

// We'll use direct component reference in the App.svelte
// and create TxtObjects there with the proper component reference

class ContentStore {
  #currentPrediction = $state<TxtObject | null>(null);
  #committedContent = $state<TxtObject[]>([]);

  get currentPrediction(): TxtObject | null {
    return this.#currentPrediction;
  }

  get committedContent(): TxtObject[] {
    return this.#committedContent;
  }

  updatePrediction(
    text: string,
    editorCss: string,
    controllerValues: Record<string, number>,
  ): void {
    // Update the current prediction without creating a new object (no flickering)
    if (this.#currentPrediction) {
      this.#currentPrediction.content = text;
      this.#currentPrediction.editorCss = editorCss;
      // Keep using the global controllerValues for the prediction (remains reactive)
    } else {
      // Create new prediction if it doesn't exist
      this.#currentPrediction = {
        // Will be set in App.svelte
        type: null as unknown as typeof SvelteComponent,
        content: text,
        editorCss,
        controllerValues, // Reference to the global values
        id: Math.random()
      };
    }
  }
  commitPrediction(): void {
    if (!this.#currentPrediction) return;
    
    // Create a frozen copy with snapshot of controller values and editorCss
    const committed = {
      ...this.#currentPrediction,
      // Take snapshots of the current values
      editorCss: $state.snapshot(this.#currentPrediction.editorCss),
      controllerValues: $state.snapshot(this.#currentPrediction.controllerValues),
      id: Math.random(),
    };
    
    // Add to committed content
    this.#committedContent = [...this.#committedContent, committed];
    // Reset prediction
    this.#currentPrediction = null;
  }

  // Additional helper methods
  clearContent(): void {
    this.#committedContent = [];
    this.#currentPrediction = null;
  }

  removeItem(id: number): void {
    this.#committedContent = this.#committedContent.filter((item) => item.id !== id);
  }
}

export const contentStore = new ContentStore();
