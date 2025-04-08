import { ChildProcess } from 'child_process';

declare global {
  // We're forced to use var in declaration files for globals
  // eslint-disable-next-line no-var
  var streamProcess: ChildProcess | null;
}

export {};
