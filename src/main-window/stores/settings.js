import { derived, get, writable } from 'svelte/store';

// Default settings structure
const defaultSettings = {
    controllerSettings: [],
    fontFamily: { name: 'Garamondt-Regular' },
    inlineStyle: '',
    svgFilters: '',
    fontSize: 1.0
};

// Helper to transform SASS to CSS
function transformSassToCSS(str, controllerSettings) {
    if (!str) return '';
    
    // Remove SASS structure (selector and braces)
    str = str.replace(/\..*{\n/gm, '')
    str = str.replace(/^}$/gm, '')
    // Remove comments
    str = str.replace(/\/\/.*$/gm, '')
    str = str.replace(/\/\*[\s\S]*?\*\//gm, '')

    if (controllerSettings && Array.isArray(controllerSettings) && controllerSettings.length > 0) {
        controllerSettings.forEach(setting => {
            // Replace $variable * number[unit] pattern
            const varPattern = new RegExp('\\$' + setting.var + '\\s*\\*\\s*([\\d.]+)([a-z%]+)?', 'g')
            str = str.replace(varPattern, (match, number, unit) => {
                const result = setting.value * parseFloat(number)
                return unit ? result + unit : result
            })

            // Replace plain $variable pattern
            const plainVarPattern = new RegExp('\\$' + setting.var + '\\b', 'g')
            str = str.replace(plainVarPattern, setting.value)
        })
    }

    return str.trim()
}

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

        // Get a snapshot of current settings for committed sentences
        getSnapshot() {
            const current = get(store);
            return JSON.parse(JSON.stringify({
                controllerSettings: current.controllerSettings,
                fontFamily: current.fontFamily,
                inlineStyle: current.inlineStyle
            }));
        },

        // Load settings from electron store and defaults
        async load(inputDefaults) {
            if (initialized) return;
            
            try {
                // Load from electron store
                const savedInlineStyle = await window.electronAPI.getStoreValue('inlineStyle');
                const savedSvgFilters = await window.electronAPI.getStoreValue('svgFilters');
                
                // Initialize with defaults and saved values
                update(current => ({
                    ...defaultSettings,
                    ...current,
                    controllerSettings: [...(inputDefaults.controllers || [])],
                    inlineStyle: savedInlineStyle || inputDefaults.inlineStyle || '',
                    svgFilters: savedSvgFilters || inputDefaults.svgFilters || '',
                    fontFamily: current.fontFamily || defaultSettings.fontFamily
                }));
                
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

// Derived store for compiled CSS
export const compiledStyle = derived(settings, $settings => 
    transformSassToCSS($settings.inlineStyle, $settings.controllerSettings)
);

// Derived store for just the controller values
export const controllerValues = derived(settings, $settings => 
    Object.fromEntries($settings.controllerSettings.map(ctrl => [ctrl.var, ctrl.value]))
); 