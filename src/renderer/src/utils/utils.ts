export const debounce = <F extends (...args: Parameters<F>) => ReturnType<F>>(
  func: F,
  waitFor: number,
): ((...args: Parameters<F>) => void) => {
  let timeout: NodeJS.Timeout;

  const debounced = (...args: Parameters<F>): void => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced;
};
