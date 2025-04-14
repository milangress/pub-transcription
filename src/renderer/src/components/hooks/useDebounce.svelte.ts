export const useDebounce = <T>(
  initialValue: T,
  delay: number = 250,
): {
  value: T;
  update: (newValue: T) => void;
  loading: boolean;
} => {
  let timeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let value = $state<T>(initialValue);
  let loading = $state<boolean>(false);

  const update = (newValue: T): void => {
    if (timeout) clearTimeout(timeout);
    loading = true;

    timeout = setTimeout(() => {
      value = newValue;
      loading = false;
    }, delay);
  };

  return {
    get value(): T {
      return value;
    },
    update,
    get loading(): boolean {
      return loading;
    },
  };
};
