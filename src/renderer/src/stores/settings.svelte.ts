import { IpcEmitter } from '@electron-toolkit/typed-ipc/renderer'
import { mapRange } from '@utils/math.js'
import type { ControllerSetting, Settings } from 'src/renderer/src/types'
import type { IpcEvents } from 'src/types/ipc'
import { WebMidi } from 'webmidi'
import defaultInlineStyle from '../assets/input-defaults/inlineStyle.js'
import inputJson from '../assets/input-defaults/input.json'
import defaultSvgFilters from '../assets/input-defaults/svgFilters.js'

const emitter = new IpcEmitter<IpcEvents>()

// Default settings structure
const defaultSettings: Settings = {
  controllerSettings: [],
  inlineStyle: '',
  svgFilters: ''
}

class SettingsStore {
  controllerSettings = $state<ControllerSetting[]>([])
  inlineStyle = $state('')
  svgFilters = $state('')
  #initialized = $state(false)
  #codeEditorContentSaved = $state(true)
  #lastSavedInlineStyle = $state('')
  #lastSavedSvgFilters = $state('')

  constructor() {
    // Initialize with default values
    this.controllerSettings = defaultSettings.controllerSettings
    this.inlineStyle = defaultSettings.inlineStyle
    this.svgFilters = defaultSettings.svgFilters
  }

  // Debounce helper
  #debounce<Args extends unknown[], R>(
    func: (...args: Args) => R,
    delay: number
  ): (...args: Args) => void {
    let timeout: NodeJS.Timeout
    return (...args: Args): void => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func.apply(this, args), delay)
    }
  }

  // Check if content is valid (not empty/whitespace and hasn't lost too much content)
  #isValidContent(newContent: string, savedContent: string): boolean {
    // Check if content is empty or just whitespace
    if (!newContent.trim()) {
      console.warn('Prevented saving empty content')
      return false
    }

    // If saved content exists, check if too much has been deleted
    if (savedContent) {
      const contentLengthReduction = 1 - newContent.length / savedContent.length

      // If more than 50% is deleted and it's more than 5 lines
      const newLines = newContent.split('\n').length
      const savedLines = savedContent.split('\n').length
      const linesReduction = savedLines - newLines

      if (contentLengthReduction > 0.5 && linesReduction > 5) {
        console.warn('Prevented saving drastically reduced content')
        return false
      }
    }

    return true
  }

  // Debounced save function
  #debouncedSave = this.#debounce(async (): Promise<void> => {
    console.log('Saving settings to electron store')

    // Check inline style content
    const isInlineStyleValid = this.#isValidContent(this.inlineStyle, this.#lastSavedInlineStyle)
    // Check SVG filters content
    const isSvgFiltersValid = this.#isValidContent(this.svgFilters, this.#lastSavedSvgFilters)

    if (!isInlineStyleValid || !isSvgFiltersValid) {
      console.warn('Safety check prevented saving potentially deleted content')
      // Reload from last saved state
      this.reloadFromSaved()
      return
    }

    // Save valid content
    await emitter.invoke('setStoreValue', 'inlineStyle', this.inlineStyle)
    await emitter.invoke('setStoreValue', 'svgFilters', this.svgFilters)

    // Update last saved values
    this.#lastSavedInlineStyle = this.inlineStyle
    this.#lastSavedSvgFilters = this.svgFilters
    this.#codeEditorContentSaved = true
  }, 1000)

  // Reload content from last saved state
  reloadFromSaved(): void {
    if (this.#lastSavedInlineStyle) {
      this.inlineStyle = this.#lastSavedInlineStyle
    }

    if (this.#lastSavedSvgFilters) {
      this.svgFilters = this.#lastSavedSvgFilters
    }

    this.#codeEditorContentSaved = true
    console.log('Reloaded content from last saved state')
  }

  // Update a specific controller value
  updateControllerValue(varName: string, newValue: number): void {
    const controller = this.controllerSettings.find((c) => c.var === varName)
    if (controller) {
      // Round to 3 decimal places and remove trailing zeros
      controller.value = parseFloat(newValue.toFixed(3))
    }
  }

  // Reset a controller to its default value
  resetController(varName: string): void {
    const controller = this.controllerSettings.find((c) => c.var === varName)
    if (controller) {
      controller.value = controller.default
    }
  }

  // Load settings from electron store and defaults
  async init(): Promise<void> {
    if (this.#initialized) return

    try {
      // Load from electron store
      const savedInlineStyle = (await emitter.invoke('getStoreValue', 'inlineStyle')) as string
      const savedSvgFilters = (await emitter.invoke('getStoreValue', 'svgFilters')) as string

      // Initialize with defaults and saved values
      const controllers = (inputJson.controllers || []) as ControllerSetting[]

      this.controllerSettings = controllers
      this.inlineStyle = savedInlineStyle || defaultInlineStyle
      this.svgFilters = savedSvgFilters || defaultSvgFilters

      // Store the initial saved values
      this.#lastSavedInlineStyle = this.inlineStyle
      this.#lastSavedSvgFilters = this.svgFilters

      console.log('init settings', this)

      this.#initialized = true
      console.log('Settings loaded successfully')
    } catch (err) {
      console.error('Error loading settings:', err)
    }
  }

  setupControllers(webMidi: typeof WebMidi): void {
    if (!webMidi || !webMidi.inputs.length) {
      console.warn('No MIDI device detected.')
      return
    }

    const mySynth = webMidi.inputs[0]

    this.controllerSettings.forEach((controller) => {
      console.log('controller', controller)
      window.setTimeout(() => {
        console.log('set synth')
        console.log('mySynth', mySynth)

        mySynth.channels[1].addListener('controlchange', (e) => {
          if (e.controller.number === controller.knobNR && typeof e.value === 'number') {
            const value = mapRange(e.value, 0, 1, controller.range[0], controller.range[1])
            this.updateControllerValue(controller.var, Number.parseFloat(value.toFixed(2)))
          }
        })
      }, 5000)
    })
  }

  // Mark content as unsaved and trigger save
  markUnsaved(): void {
    this.#codeEditorContentSaved = false
    this.#debouncedSave()
  }

  // Computed values
  get codeEditorContentSaved(): boolean {
    return this.#codeEditorContentSaved
  }

  get controllerValues(): Record<string, number> {
    return Object.fromEntries(this.controllerSettings.map((ctrl) => [ctrl.var, ctrl.value]))
  }

  get filterIds(): string[] {
    return extractFilterIds(this.svgFilters)
  }
}

// Helper function to extract filter IDs from SVG code
function extractFilterIds(svgCode: string): string[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgCode, 'text/html')
  const filters = doc.querySelectorAll('filter[id]')
  return Array.from(filters).map((filter) => filter.id)
}

// Create and export a single instance of the settings store
export const settings = new SettingsStore()
