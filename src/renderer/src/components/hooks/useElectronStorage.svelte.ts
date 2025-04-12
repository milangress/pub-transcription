import { IpcEmitter } from '@electron-toolkit/typed-ipc/renderer';
import type { IpcEvents } from 'src/types/ipc';

const emitter = new IpcEmitter<IpcEvents>();

/**
 * A hook to persist data in Electron's store
 * @param key The key to store the value under in Electron's store
 * @param initialValue The initial value to use
 * @returns An object with getter and setter for the value
 */
const useElectronStorage = <T>(
  key: string,
  initialValue: T,
): {
  set value(v: T);
  get value(): T;
  isLoaded: boolean;
} => {
  let value = $state<T>(initialValue);
  let isLoaded = $state(false);

  // Initialize from electron store immediately
  (async (): Promise<void> => {
    try {
      const storedValue = (await emitter.invoke('getStoreValue', key)) as T;
      if (storedValue !== undefined && storedValue !== null) {
        value = storedValue;
      }
      isLoaded = true;
    } catch (error) {
      console.error(`Error loading value from Electron store for key "${key}":`, error);
      isLoaded = true;
    }
  })();

  const save = async (): Promise<void> => {
    try {
      if (value !== null && value !== undefined) {
        await emitter.invoke('setStoreValue', key, value);
      } else {
        // If value is null/undefined, we could optionally delete the key
        // await emitter.invoke('deleteStoreValue', key); // You would need to implement this IPC event
      }
    } catch (error) {
      console.error(`Error saving value to Electron store for key "${key}":`, error);
    }
  };

  return {
    get value(): T {
      return value;
    },
    set value(v: T) {
      value = v;
      save();
    },
    get isLoaded(): boolean {
      return isLoaded;
    },
  };
};

export default useElectronStorage;
