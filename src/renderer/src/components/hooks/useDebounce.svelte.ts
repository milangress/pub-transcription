export const useDebounce = (
  initialValue: unknown,
  delay: number = 250,
): {
  value: unknown;
  update: (newValue: unknown) => void;
  loading: boolean;
} => {
  let timeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let value = $state<unknown>(initialValue);
  let loading = $state<boolean>(false);

  const update = (newValue: unknown): void => {
    if (timeout) clearTimeout(timeout);
    loading = true;

    timeout = setTimeout(() => {
      value = newValue;
      loading = false;
    }, delay);
  };

  return {
    get value(): unknown {
      return value;
    },
    update,
    get loading(): boolean {
      return loading;
    },
  };
};
