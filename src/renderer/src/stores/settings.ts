import type { ControllerSetting, Settings } from 'src/renderer/src/types'
import { derived, get, writable, type Writable } from 'svelte/store'
import { WebMidi } from 'webmidi'

import defaultInlineStyle from '../assets/input-defaults/inlineStyle.js'
import inputJson from '../assets/input-defaults/input.json'
import defaultSvgFilters from '../assets/input-defaults/svgFilters.js'

import { mapRange } from '@utils/math.js'

// Default settings structure
const defaultSettings: Settings = {
  controllerSettings: [],
  inlineStyle: '',
  svgFilters: ''
}

interface SettingsStore extends Writable<Settings> {
  updateControllerValue: (varName: string, newValue: number) => void
  resetController: (varName: string) => void
  init: () => Promise<void>
  setupControllers: (webMidi: typeof WebMidi) => void
  markUnsaved: () => void
  codeEditorContentSaved: { subscribe: Writable<boolean>['subscribe'] }
}

// Create the base store
function createSettingsStore(): SettingsStore {
  const { subscribe, set, update } = writable<Settings>(defaultSettings)
  let initialized = false
  const codeEditorContentSaved = writable(true)

  // Debounce helper
  function debounce<Args extends unknown[], R>(
    func: (...args: Args) => R,
    delay: number
  ): (...args: Args) => void {
    let timeout: NodeJS.Timeout
    return function (this: unknown, ...args: Args) {
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(this, args), delay)
    }
  }

  // Debounced save function
  const debouncedSave = debounce(async () => {
    console.log('Saving settings to electron store')
    const currentSettings = get(store)
    await window.electron.ipcRenderer.invoke(
      'setStoreValue',
      'inlineStyle',
      currentSettings.inlineStyle
    )
    await window.electron.ipcRenderer.invoke(
      'setStoreValue',
      'svgFilters',
      currentSettings.svgFilters
    )
    codeEditorContentSaved.set(true)
  }, 1000)

  const store: SettingsStore = {
    subscribe,
    set,
    update,

    // Update a specific controller value
    updateControllerValue(varName: string, newValue: number) {
      update((settings) => {
        const controller = settings.controllerSettings.find((c) => c.var === varName)
        if (controller) {
          // Clamp value to controller range
          const min = controller.range[0]
          const max = controller.range[1]
          controller.value = Math.max(min, Math.min(max, newValue))
        }
        return settings
      })
    },

    // Reset a controller to its default value
    resetController(varName: string) {
      update((settings) => {
        const controller = settings.controllerSettings.find((c) => c.var === varName)
        if (controller) {
          controller.value = controller.default
        }
        return settings
      })
    },

    // Load settings from electron store and defaults
    async init() {
      if (initialized) return

      try {
        // Load from electron store
        const savedInlineStyle = await window.electron.ipcRenderer.invoke(
          'getStoreValue',
          'inlineStyle'
        )
        const savedSvgFilters = await window.electron.ipcRenderer.invoke(
          'getStoreValue',
          'svgFilters'
        )

        // Initialize with defaults and saved values
        const controllers = (inputJson.controllers || []) as ControllerSetting[]

        update(() => ({
          ...defaultSettings,
          controllerSettings: controllers,
          inlineStyle: savedInlineStyle || defaultInlineStyle,
          svgFilters: savedSvgFilters || defaultSvgFilters
        }))

        console.log('init settings', get(store))

        initialized = true
        console.log('Settings loaded successfully')
      } catch (err) {
        console.error('Error loading settings:', err)
      }
    },

    setupControllers(webMidi: typeof WebMidi) {
      if (!webMidi || !webMidi.inputs.length) {
        console.warn('No MIDI device detected.')
        return
      }

      const mySynth = webMidi.inputs[0]
      const currentSettings = get(store)

      currentSettings.controllerSettings.forEach((controller) => {
        console.log('controller', controller)
        window.setTimeout(() => {
          console.log('set synth')
          console.log('mySynth', mySynth)

          mySynth.channels[1].addListener('controlchange', (e) => {
            if (e.controller.number === controller.knobNR && typeof e.value === 'number') {
              const value = mapRange(e.value, 0, 1, controller.range[0], controller.range[1])
              store.updateControllerValue(controller.var, Number.parseFloat(value.toFixed(2)))
            }
          })
        }, 5000)
      })
    },

    // Mark content as unsaved and trigger save
    markUnsaved() {
      codeEditorContentSaved.set(false)
      debouncedSave()
    },

    codeEditorContentSaved: { subscribe: codeEditorContentSaved.subscribe }
  }

  return store
}

// Create the main settings store
export const settings = createSettingsStore()

// Derived store for just the controller values
export const controllerValues = derived(settings, ($settings) =>
  Object.fromEntries($settings.controllerSettings.map((ctrl) => [ctrl.var, ctrl.value]))
)
