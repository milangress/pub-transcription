import { powerSaveBlocker } from 'electron';

export function startPowerSaveBlocker(logtoWindow: (message: string) => void): () => void {
  const id = powerSaveBlocker.start('prevent-display-sleep');
  if (powerSaveBlocker.isStarted(id)) {
    logtoWindow('✅ Power save blocker started');
  } else {
    logtoWindow('❌ Power save blocker failed to start');
  }
  return () => {
    powerSaveBlocker.stop(id);
    logtoWindow('❌ Power save blocker stopped');
  };
}
