interface Status {
  Ok(): boolean;
  Fail(): boolean;
  Of(cls: new (...args: unknown[]) => Error): boolean;
}

class JsonError extends Error implements Status {
  constructor(
    message: string,
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'JsonError';
  }

  Ok(): boolean {
    return false;
  }

  Fail(): boolean {
    return true;
  }

  Of(cls: new (...args: unknown[]) => Error): boolean {
    return this.originalError instanceof cls;
  }
}

class NoError implements Status {
  Ok(): boolean {
    return true;
  }

  Fail(): boolean {
    return false;
  }

  Of(): boolean {
    return false;
  }
}

const NO_ERROR = new NoError();

/**
 * Safe JSON parse that returns a tuple of [parsed value, error]
 */
export function jsonSafeParse<T>(text: string): [T, Status] {
  try {
    return [JSON.parse(text) as T, NO_ERROR];
  } catch (error) {
    return [
      text as unknown as T,
      new JsonError('Failed to parse JSON', error instanceof Error ? error : undefined),
    ];
  }
}

/**
 * Wraps a value in a tuple with error status, parsing if it's a string
 * @param value The value to wrap
 * @param wrapper Optional function to wrap the value before returning
 */
export function jsonSafeParseWrap<T, R = T>(
  value: string | T,
  wrapper?: (val: T) => R,
): [R, Status] {
  if (typeof value === 'string') {
    const [parsed, error] = jsonSafeParse<T>(value);
    if (error.Fail()) {
      return [value as unknown as R, error];
    }
    value = parsed!;
  }

  try {
    return [wrapper ? wrapper(value as T) : (value as unknown as R), NO_ERROR];
  } catch (error) {
    return [
      value as unknown as R,
      new JsonError('Failed to wrap value', error instanceof Error ? error : undefined),
    ];
  }
}

/**
 * Safe JSON stringify that returns a tuple of [string value, error], parsing and wrapping if needed
 * @param value The value to stringify
 * @param wrapper Optional function to wrap the value before stringifying
 */
export function jsonSafeParseWrapStringify<T, R = T>(
  value: string | T,
  wrapper?: (val: T) => R,
): [string, Status] {
  const [wrapped, wrapError] = jsonSafeParseWrap(value, wrapper);
  if (wrapError.Fail()) {
    return [value as unknown as string, wrapError];
  }

  try {
    return [JSON.stringify(wrapped), NO_ERROR];
  } catch (error) {
    return [
      value as unknown as string,
      new JsonError('Failed to stringify JSON', error instanceof Error ? error : undefined),
    ];
  }
}
