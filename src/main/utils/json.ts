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
export function jsonSafeParse<T>(text: string): [T | null, Status] {
  try {
    return [JSON.parse(text) as T, NO_ERROR];
  } catch (error) {
    return [
      null,
      new JsonError('Failed to parse JSON', error instanceof Error ? error : undefined),
    ];
  }
}

/**
 * Wraps a value in a tuple with error status
 */
export function jsonSafeParseWrap<T>(value: T): [T, Status] {
  return [value, NO_ERROR];
}

/**
 * Safe JSON stringify that returns a tuple of [string value, error]
 */
export function jsonSafeParseWrapStringify<T>(value: T): [string | null, Status] {
  try {
    return [JSON.stringify(value), NO_ERROR];
  } catch (error) {
    return [
      null,
      new JsonError('Failed to stringify JSON', error instanceof Error ? error : undefined),
    ];
  }
}
