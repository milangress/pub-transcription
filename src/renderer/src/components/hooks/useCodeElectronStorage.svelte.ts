import { IpcEmitter } from '@electron-toolkit/typed-ipc/renderer';
import type { IpcEvents } from 'src/types/ipc';

const emitter = new IpcEmitter<IpcEvents>();

/**
 * A specialized hook for storing code content in Electron's store with validation
 * @param key The key to store the value under in Electron's store
 * @param initialValue The initial default value to use
 * @returns An object with getter, setter, and utility methods
 */
const useCodeElectronStorage = (
  key: string,
  initialValue: string,
): {
  set value(v: string);
  get value(): string;
  initialized: boolean;
  contentSaved: boolean;
  reloadFromSaved: () => void;
  markUnsaved: () => void;
} => {
  let value = $state(initialValue);
  let initialized = $state(false);
  let contentSaved = $state(true);
  let lastSavedValue = $state('');

  // Debounce helper
  const debounce = <Args extends unknown[], R>(
    func: (...args: Args) => R,
    delay: number,
  ): ((...args: Args) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Args): void => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), delay);
    };
  };

  // Check if content is valid (not empty/whitespace and hasn't lost too much content)
  const isValidContent = (newContent: string, savedContent: string): boolean => {
    // Check if content is empty or just whitespace
    if (!newContent.trim()) {
      console.warn('Prevented saving empty content');
      return false;
    }

    // If saved content exists, check if too much has been deleted
    if (savedContent) {
      const contentLengthReduction = 1 - newContent.length / savedContent.length;

      // If more than 50% is deleted and it's more than 5 lines
      const newLines = newContent.split('\n').length;
      const savedLines = savedContent.split('\n').length;
      const linesReduction = savedLines - newLines;

      if (contentLengthReduction > 0.5 && linesReduction > 5) {
        console.warn('Prevented saving drastically reduced content');
        return false;
      }
    }

    return true;
  };

  // Debounced save function
  const debouncedSave = debounce(async (): Promise<void> => {
    console.log(`Saving ${key} to electron store`);

    const isContentValid = isValidContent(value, lastSavedValue);

    if (!isContentValid) {
      console.warn('Safety check prevented saving potentially deleted content');
      reloadFromSaved();
      return;
    }

    // Save valid content
    await emitter.invoke('setStoreValue', key, value);

    // Notify other windows about the settings change
    emitter.send('editor:settings-updated', {
      [key]: value,
    });

    // Update last saved value
    lastSavedValue = value;
    contentSaved = true;
  }, 1000);

  // Reload content from last saved state
  const reloadFromSaved = (): void => {
    if (lastSavedValue) {
      value = lastSavedValue;
    }
    contentSaved = true;
    console.log(`Reloaded ${key} from last saved state`);
  };

  // Mark content as unsaved and trigger save
  const markUnsaved = (): void => {
    contentSaved = false;
    debouncedSave();
  };

  // Initialize from electron store immediately
  (async (): Promise<void> => {
    try {
      const savedValue = (await emitter.invoke('getStoreValue', key)) as string;

      if (savedValue) {
        value = savedValue;
        lastSavedValue = savedValue;
      } else {
        value = initialValue;
        lastSavedValue = initialValue;
      }

      initialized = true;
      console.log(`${key} loaded successfully`);
    } catch (err) {
      console.error(`Error loading ${key}:`, err);
      initialized = true; // Still mark as initialized even if there's an error
    }
  })();

  return {
    get value(): string {
      return value;
    },
    set value(v: string) {
      value = v;
      markUnsaved();
    },
    get initialized(): boolean {
      return initialized;
    },
    get contentSaved(): boolean {
      return contentSaved;
    },
    reloadFromSaved,
    markUnsaved,
  };
};

export default useCodeElectronStorage;
