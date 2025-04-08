import { IpcEmitter } from '@electron-toolkit/typed-ipc/renderer';
import type { CommandResponse, IpcEvents } from 'src/types/ipc';

const emitter = new IpcEmitter<IpcEvents>();

class CommandStore {
  async execute<T>(command: string, payload?: unknown): Promise<CommandResponse<T>> {
    try {
      const response = (await emitter.invoke(
        'command:execute',
        command,
        payload,
      )) as CommandResponse<T>;
      return response;
    } catch (error) {
      console.error(`Error executing command ${command}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}

export const commands = new CommandStore();
