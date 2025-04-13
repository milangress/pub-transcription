<script lang="ts">
  import { IpcListener } from '@electron-toolkit/typed-ipc/renderer';
  import { onMount } from 'svelte';
  const ipc = new IpcListener();

  let isFullScreen = $state(false);

  let titlebarHeight = $derived(isFullScreen ? 0 : 28);

  onMount(() => {
    console.log('TitleBar mounted');
  });
  ipc.on('enter-full-screen', () => {
    console.log('Entering full screen');
    isFullScreen = true;
  });
  ipc.on('exit-full-screen', () => {
    console.log('Exiting full screen');
    isFullScreen = false;
  });
</script>

<div class="titleBar" style={`--title-bar-height: ${titlebarHeight}px`}></div>

<style>
  .titleBar {
    -webkit-app-select: none;
    -webkit-app-region: drag;
    background-color: #ffffff;
    width: 100%;
    height: var(--title-bar-height);
    position: fixed;
    top: 0;
    left: 0;
    z-index: 1000;
    border-bottom: 1px solid #000000;
  }
  .titleBar::hover {
    background-color: #00ff00;
  }
</style>
