<script>
    import { settings } from '../../stores/settings.js';
    import MIDIKnobPreview from "./MIDIKnobPreview.svelte";

    export let controllerSettings;

    function resetValueToDefault(item) {
        settings.resetController(item.var);
    }

    let copySuccess = false;
    const copyContent = async (text) => {
        try {
            const varNameAsSass = "$" + text;
            await navigator.clipboard.writeText(varNameAsSass);
            console.log('Content copied to clipboard');
            copySuccess = true;
            setTimeout(() => {
                copySuccess = false;
            }, 100);
        } catch (err) {
            console.error('Failed to copy: ', err);
        }
    }

    function handleSliderChange(item, event) {
        settings.updateControllerValue(item.var, parseFloat(event.target.value));
    }
</script>

<hr>
<div class="controller-wrapper">
{#each controllerSettings as item}
    <div class="item">
        <MIDIKnobPreview knobNR={item.knobNR} />
        <div>
            <p><strong>{item.name}</strong></p>
            <p>{item.range[0]}/{item.range[1]}</p>
        </div>
        <div class="key-input">
            <p>-{item.keys.down}  +{item.keys.up}</p>
            <p>+-{item.step}</p>
        </div>
        <div class="var" 
            role="button" 
            tabindex="0" 
            on:click={() => copyContent(item.var)}
            on:keydown={e => e.key === 'Enter' && copyContent(item.var)}>
            <p class:copySuccess>{item.var}</p>
        </div>
        <div class="value" 
            role="button" 
            tabindex="0" 
            on:click={() => resetValueToDefault(item)}
            on:keydown={e => e.key === 'Enter' && resetValueToDefault(item)}>
            <p>{item.value}</p>
        </div>
        <div class="input-slider">
            <input 
                type="range" 
                id={item.name} 
                name={item.name} 
                min={item.range[0]} 
                max={item.range[1]} 
                step={item.step} 
                value={item.value}
                on:input={(e) => handleSliderChange(item, e)}
            >
        </div>
    </div>
{/each}
</div>

<style>
    .copySuccess {
        color: #00ff00;
    }
    .controller-wrapper {
        display: grid;
        grid-template-columns: 1fr 1fr;
        font-size: 0.8em;
        grid-gap: 0.8rem;
    }
    .item {
        display: grid;
        grid-template-columns: min-content 1.5fr 1fr 1fr 1.5fr;
        border: 1px solid #000;
        padding: 0.5rem;
        border-radius: 1em;
    }
    .item input {
        width: 100%;
    }
    .item p {
        margin: 0;
    }
    .var, .value {
        text-align: right;
        font-size: 1.2em;
        font-weight: bold;
    }
    .var:hover {
        color: #00ff00;
    }
    .value {
        cursor: pointer;
    }
    .value:hover {
        color: #00ff00;
    }
    .input-slider{
        grid-column: 1 / span 5;
        height: 1.2em;
    }
</style>
