import { IpcEmitter } from '@electron-toolkit/typed-ipc/renderer'
import { mapRange } from '@utils/math.js'
import type { ControllerSetting, Settings } from 'src/renderer/src/types'
import type { SettingsSnapshot } from 'src/types'
import type { IpcEvents } from 'src/types/ipc'
import { v4 as uuidv4 } from 'uuid'
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
  #snapshots = $state<SettingsSnapshot[]>([])
  #snapshotsLoaded = $state(false)

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
      // Round to 2 decimal places and remove trailing zeros
      controller.value = parseFloat(newValue.toFixed(2))
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

  // Create and save a new settings snapshot
  async saveSnapshot(name: string = ''): Promise<SettingsSnapshot | null> {
    try {
      // Create a snapshot of the current settings
      const snapshot: SettingsSnapshot = {
        id: uuidv4(),
        name: name || `Snapshot ${new Date().toLocaleString()}`,
        timestamp: Date.now(),
        inlineStyle: this.inlineStyle,
        svgFilters: this.svgFilters,
        controllerValues: this.controllerValues
      }

      // Save the snapshot via IPC
      const savedSnapshot = await emitter.invoke('save-settings-snapshot', snapshot)
      console.log('Saved settings snapshot:', savedSnapshot)

      // Update local snapshots list
      await this.loadSnapshots()

      return savedSnapshot
    } catch (error) {
      console.error('Error saving settings snapshot:', error)
      return null
    }
  }

  // Load all available snapshots
  async loadSnapshots(): Promise<SettingsSnapshot[]> {
    try {
      const response = await emitter.invoke('get-settings-snapshots')
      
      if (response.success) {
        this.#snapshots = response.snapshots
        this.#snapshotsLoaded = true
      } else {
        console.error('Error loading snapshots:', response.error)
      }
      
      return this.#snapshots
    } catch (error) {
      console.error('Error loading snapshots:', error)
      return []
    }
  }

  // Apply a settings snapshot
  async applySnapshot(id: string): Promise<boolean> {
    try {
      const snapshot = await emitter.invoke('load-settings-snapshot', id)
      
      if (!snapshot) {
        console.error(`Snapshot with ID ${id} not found`)
        return false
      }
      
      // Apply the snapshot values
      this.inlineStyle = snapshot.inlineStyle
      this.svgFilters = snapshot.svgFilters
      
      // Update controller values
      if (snapshot.controllerValues) {
        Object.entries(snapshot.controllerValues).forEach(([varName, value]) => {
          this.updateControllerValue(varName, value)
        })
      }
      
      // Save the applied values to electron store
      await this.#debouncedSave()
      
      console.log(`Applied snapshot: ${snapshot.name}`)
      return true
    } catch (error) {
      console.error(`Error applying snapshot with ID ${id}:`, error)
      return false
    }
  }

  // Delete a settings snapshot
  async deleteSnapshot(id: string): Promise<boolean> {
    try {
      const success = await emitter.invoke('delete-settings-snapshot', id)
      
      if (success) {
        // Refresh snapshots list
        await this.loadSnapshots()
        console.log(`Deleted snapshot with ID ${id}`)
      } else {
        console.error(`Failed to delete snapshot with ID ${id}`)
      }
      
      return success
    } catch (error) {
      console.error(`Error deleting snapshot with ID ${id}:`, error)
      return false
    }
  }

  // Get all snapshots
  get snapshots(): SettingsSnapshot[] {
    if (!this.#snapshotsLoaded) {
      this.loadSnapshots().catch(console.error)
    }
    return this.#snapshots
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
