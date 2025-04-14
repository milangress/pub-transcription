import BlockTxt from '@components/pageElement/BlockTxt.svelte';
import type { TxtObject } from 'src/renderer/src/types';
import type { SvelteComponent } from 'svelte';
import type { WhisperStreamOutput } from '../../../types/whisperParser';
import { remoteSettings } from './remoteSettings.svelte.ts';
import { settings } from './settings.svelte.js';

// We'll use direct component reference in the App.svelte
// and create TxtObjects there with the proper component reference

class ContentStore {
  #currentPrediction = $state<TxtObject | null>(null);
  #committedContent = $state<TxtObject[]>([]);

  #predictionCounter = $state(0);

  #silencePatterns = $state([
    '[ Silence ]',
    '[silence]',
    '[BLANK_AUDIO]',
    '[ [ [ [',
    '[ [ [',
    '[ [',
    '(buzzer)',
    '(buzzing)',
    '.',
  ]);

  get currentPrediction(): TxtObject | null {
    return this.#currentPrediction;
  }

  get committedContent(): TxtObject[] {
    return this.#committedContent;
  }

  updatePrediction(data: WhisperStreamOutput): void {
    if (data.type !== 'prediction') return;
    this.#predictionCounter++;

    if (this.#currentPrediction) {
      this.#currentPrediction.content = data.text;
      this.#currentPrediction.editorCss = remoteSettings.editorCss;
      this.#currentPrediction.controllerValues = settings.controllerValues;
      this.#currentPrediction.type = BlockTxt as unknown as typeof SvelteComponent;
    } else {
      this.#currentPrediction = {
        type: BlockTxt as unknown as typeof SvelteComponent,
        content: data.text,
        editorCss: remoteSettings.editorCss,
        controllerValues: settings.controllerValues,
        id: Math.random(),
      };
    }
  }

  private isSilenceOrNoise(text: string): boolean {
    return this.#silencePatterns.some((pattern) =>
      text.toLowerCase().includes(pattern.toLowerCase()),
    );
  }

  commitPrediction(prediction: TxtObject): void {
    if (!prediction) return;
    if (this.isSilenceOrNoise(prediction.content)) return;
    this.#predictionCounter = 0;

    console.log('👀 [Commit]', prediction.content);

    const committed = {
      ...prediction,
      editorCss: $state.snapshot(remoteSettings.editorCss),
      controllerValues: $state.snapshot(settings.controllerValues),
    };

    this.#committedContent.push(committed);
  }

  // Additional helper methods
  clearContent(): void {
    this.#committedContent = [];
    this.#currentPrediction = null;
  }

  removeItem(id: number): void {
    this.#committedContent = this.#committedContent.filter((item) => item.id !== id);
  }

  get predictionCounter(): number {
    return this.#predictionCounter;
  }
}

export const contentStore = new ContentStore();
