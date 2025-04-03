import { derived, writable } from 'svelte/store';

// Default settings
const defaultSettings = {
    controllerSettings: [],
    fontFamily: { name: 'Garamondt-Regular' }, // Default font
    inlineStyle: '',
    fontSize: 1.0 // Add default font size
};

// Create the base store
function createSettingsStore() {
    const { subscribe, set, update } = writable(defaultSettings);

    return {
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

        // Update font family
        setFontFamily(font) {
            update(settings => ({ ...settings, fontFamily: font }));
        },

        // Update inline style
        setInlineStyle(style) {
            update(settings => ({ ...settings, inlineStyle: style }));
        },

        // Initialize settings
        init(initialSettings) {
            update(current => ({
                ...defaultSettings,
                ...current,
                ...initialSettings,
                // Ensure fontFamily is always an object with a name
                fontFamily: initialSettings.fontFamily || current.fontFamily || defaultSettings.fontFamily
            }));
        }
    };
}

// Create and export the store
export const settings = createSettingsStore();

// Derived store for just the controller values
export const controllerValues = derived(settings, $settings => {
    return Object.fromEntries(
        $settings.controllerSettings.map(ctrl => [ctrl.var, ctrl.value])
    );
}); 