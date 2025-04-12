import { onMount } from 'svelte';

/**
 * A hook to persist data in localStorage
 * @param key The key to store the value under in localStorage
 * @param initialValue The initial value to use
 * @returns An object with getter and setter for the value
 */
const useLocalStorage = <T>(
  key: string,
  initialValue: T,
): {
  set value(v: T);
  get value(): T;
} => {
  let value = $state<T>(initialValue);

  onMount(() => {
    const currentValue = localStorage.getItem(key);
    if (currentValue) {
      try {
        value = JSON.parse(currentValue) as T;
      } catch (error) {
        console.error(`Error parsing localStorage value for key "${key}":`, error);
      }
    }
  });

  const save = (): void => {
    if (value !== null && value !== undefined) {
      localStorage.setItem(key, JSON.stringify(value));
    } else {
      localStorage.removeItem(key);
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
  };
};

export default useLocalStorage;
