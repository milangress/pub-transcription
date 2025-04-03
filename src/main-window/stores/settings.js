import { derived, get, writable } from 'svelte/store';

import defaultInlineStyle from "../../../input-defaults/inlineStyle.js";
import inputJson from "../../../input-defaults/input.json";
import defaultSvgFilters from "../../../input-defaults/svgFilters.js";

// Default settings structure
const defaultSettings = {
    controllerSettings: [],
    inlineStyle: '',
    svgFilters: '',
};

// Create the base store
function createSettingsStore() {
    const { subscribe, set, update } = writable(defaultSettings);
    let initialized = false;
    const codeEditorContentSaved = writable(true);

    // Debounce helper
    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Debounced save function
    const debouncedSave = debounce(async () => {
        console.log("Saving settings to electron store");
        const currentSettings = get(store);
        await window.electronAPI.setStoreValue('inlineStyle', currentSettings.inlineStyle);
        await window.electronAPI.setStoreValue('svgFilters', currentSettings.svgFilters);
        codeEditorContentSaved.set(true);
    }, 1000);

    const store = {
        subscribe,
        set,
        
        // Update a specific controller value
        updateControllerValue(varName, newValue) {
            update(settings => {
                const controller = settings.controllerSettings.find(c => c.var === varName);
                if (controller) {
                    // Clamp value to controller range
                    const min = controller.range[0];
                    const max = controller.range[1];
                    controller.value = Math.max(min, Math.min(max, newValue));
                }
                return settings;
            });
        },

        // Reset a controller to its default value
        resetController(varName) {
            update(settings => {
                const controller = settings.controllerSettings.find(c => c.var === varName);
                if (controller) {
                    controller.value = controller.default;
                }
                return settings;
            });
        },

        // Load settings from electron store and defaults
        async init() {
            if (initialized) return;
            
            try {
                // Load from electron store
                const savedInlineStyle = await window.electronAPI.getStoreValue('inlineStyle');
                const savedSvgFilters = await window.electronAPI.getStoreValue('svgFilters');
                
                // Initialize with defaults and saved values
                update(current => ({
                    controllerSettings: [...(inputJson.controllers || [])],
                    inlineStyle: savedInlineStyle || defaultInlineStyle,
                    svgFilters: savedSvgFilters || defaultSvgFilters,
                }));

                console.log("init settings", get(store))
                
                initialized = true;
                console.log('Settings loaded successfully');
            } catch (err) {
                console.error('Error loading settings:', err);
            }
        },

        // Mark content as unsaved and trigger save
        markUnsaved() {
            codeEditorContentSaved.set(false);
            debouncedSave();
        }
    };

    return {
        ...store,
        codeEditorContentSaved: { subscribe: codeEditorContentSaved.subscribe }
    };
}

// Create the main settings store
export const settings = createSettingsStore();

// Derived store for just the controller values
export const controllerValues = derived(settings, $settings => 
    Object.fromEntries($settings.controllerSettings.map(ctrl => [ctrl.var, ctrl.value]))
); 