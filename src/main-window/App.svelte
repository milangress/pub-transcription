<script>
	import { tick } from 'svelte';
	import { writable } from 'svelte/store';
	import CodeEditor from "./components/CodeEditor.svelte";
	import ControllerManager from "./components/midi/ControllerManager.svelte";
	import BlockTxt from "./components/pageElement/BlockTxt.svelte";
	import PrintStatusBar from './components/PrintStatusBar.svelte';
	import TransInfoMessagesLog from './components/TransInfoMessagesLog.svelte';
	import { settings } from './stores/settings.js';


	let loremIpsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec euismod, nisl nec aliquam ultricies, nunc nisl aliquet nunc, nec aliquam n'

	let unwantedTragmentsDontCommit = ['[ Silence ]', '[silence]', '[BLANK_AUDIO]', '[ [ [ [','[ [ [','[ [', '[', '(buzzer)', '(buzzing)', '.']

	// Only Contains the final sentences
	let committedContent = []

	// Contains all incoming TTS sentences
	let allIncomingTTSMessages = []

	let currentSentence = {}

	// only Info and debug messages
	let transInfoMessages = []

	let currentSentenceRef = null

	let fontFamilys = [
		{
			name: 'Garamondt-Regular',
		}, {
			name: 'American Typewriter',
		}, {
			name: 'Arial',
		}, {
			name: 'Arial Black',
		}, {
			name: 'Arial Narrow',
		}, {
			name: 'SpaceMono'
		}, {
			name: 'Unifont'
		}, {
			name: 'OracleGM-RegularMono'
		}, {
			name: 'Neureal-Regular'
		}, {
			name: 'NIKITA-Regular'
		}, {
			name: 'Yorkshire'
		}
	]

	let printerSettings = {
		deviceName: 'Xerox_Phaser_5550N',
		forcePrint: false
	}
	let isSuccessfulPrint = true

	let mySynth = null

	let printStatusBar;

	// Store for sentences waiting to be committed while printing
	let isPrinting = writable(false)
	let isHandlingOverflow = false  // Flag to prevent recursive overflow handling

	// Initialize settings when the app starts
	$: {
		if (!$settings.controllerSettings.length) settings.init();
	}

	$: codeEditorContentSaved = settings.codeEditorContentSaved;

	$: currentContentList = [...committedContent, currentSentence]

	window.electronAPI.onTranscriptionData((event, value) => {
		allIncomingTTSMessages = [value, ...allIncomingTTSMessages]
		const formattedSentence = formatTTSasTxtObject(value)

		if (isHandlingOverflow) {
			console.warn("Overflow handling in progress, discarding:", value)
			return
		}
		
		if (String(value).endsWith('NEW')) {
			// Final sentence received
			currentSentence = {} // Clear current visualization
			
			// Only commit if it's not in the unwanted list
			if (!unwantedTragmentsDontCommit.some(x => x.toLowerCase() === formattedSentence.content.toLowerCase().trim())) {
				console.log("Commiting finalSentence", formattedSentence.content);
				committedContent = [...committedContent, formattedSentence];
			}
		} else {
			// Always show partial results, even if they would be filtered when final
			currentSentence = formattedSentence
		}
	})

	function formatTTSasTxtObject(tts) {
		const removeNEWKeyword = String(tts).replace('NEW', '').trim()
		return {
			type: BlockTxt,
			content: removeNEWKeyword,
			settings: JSON.parse(JSON.stringify($settings)), // Deep copy of current settings
			id: Math.random()
		}
	}


	// Watch for code changes and mark as unsaved
	$: if ($settings.inlineStyle || $settings.svgFilters) {
		settings.markUnsaved();
	}

	async function handleOverflow(overflowingItem) {
		// Don't handle overflow if we're already handling overflow
		if (isHandlingOverflow) return;

		try {
			isHandlingOverflow = true;
			console.log("Handling overflow for:", overflowingItem.content);
			
			// Find the index of the overflowing item
			const index = committedContent.findIndex(item => item.id === overflowingItem.id);
			if (index === -1) return;

			// If this is the first item on the page and it's overflowing,
			// we need to handle it specially to avoid an infinite loop
			if (index === 0) {
				console.warn("First item on page is overflowing - forcing it to print alone:", overflowingItem.content);
				// Print just this item on its own page
				const itemToPrint = [overflowingItem];
				const remainingItems = committedContent.slice(1);
				
				// Update committed content to only include the overflowing item
				committedContent = itemToPrint;
				await tick(); // Wait for DOM update
				
				// Print current page and continue with remaining items
				await printFile();
				// Clear the printed content before setting the remaining items
				committedContent = [];
				await tick(); // Wait for DOM update
				committedContent = remainingItems;
				return;
			}

			// Normal case - split at the overflowing item
			const itemsToPrint = committedContent.slice(0, index);
			const itemsForNextPage = committedContent.slice(index);
			
			// Print current page and continue with remaining items
			committedContent = itemsToPrint;
			await tick(); // Wait for DOM update
			await printFile();
			// Clear the printed content before setting the remaining items
			committedContent = [];
			await tick(); // Wait for DOM update
			committedContent = itemsForNextPage;
		} finally {
			isHandlingOverflow = false;
		}
	}

	async function printFile() {
		console.log("🖨️ Starting print process");
		await tick(); // Wait for DOM update
		
		try {
			const pageElement = document.querySelector('page');
			if (!pageElement) {
				console.error('❌ No page element found');
				isSuccessfulPrint = false;
				return;
			}

			// Remove any current elements before printing
			const currentElements = pageElement.querySelectorAll('.current');
			currentElements.forEach(element => {
				element.remove();
				console.log("removed current element", element.textContent.trim())
			});

			const pageContent = pageElement.innerHTML;
			if (!pageContent || typeof pageContent !== 'string') {
				console.error('❌ Invalid page content');
				isSuccessfulPrint = false;
				return;
			}

			// Create a print request in the status bar
			const printId = printStatusBar.addPrintRequest();
			console.log(`📝 Created print request with ID: ${printId}`);

			console.log("Printing text: ", pageElement.textContent.trim())

			const printSettings = {
				...printerSettings,
				silent: true,
				printBackground: true,
				printSelectionOnly: false,
				landscape: false,
				pageSize: 'A3',
				margins: {
					marginType: 'custom',
					top: 0,
					bottom: 0,
					left: 0,
					right: 0
				},
				inlineStyle: $settings.inlineStyle,
				svgFilters: $settings.svgFilters,
				printId
			};
			
			await window.electronAPI.print(pageContent, printSettings);
		} catch (error) {
			console.error('❌ Print error:', error);
			isSuccessfulPrint = false;
		}
	}

	function clearAll() {
		console.log("🗑️ Clearing all content");
		committedContent = []
	}



	WebMidi
			.enable()
			.then(onEnabled)
			.catch(err => alert(err));

	function onEnabled() {

		if (WebMidi.inputs.length < 1) {
			console.warn("No MIDI device detected.")
		} else {
			WebMidi.inputs.forEach((device, index) => {
				console.log(`MIDI DEVICE: ${index}: ${device.name} <br>`)
			});
			mySynth = WebMidi.inputs[0];
		}
	}

</script>

<!-- svelte:head meta title -->
<svelte:head>
	<title>a-trans(crip)tion-live-coding-VJ-PDF-printing-tool</title>
</svelte:head>

<main>
	{#if currentContentList.length > 0}
		<div class="print-context">
			<page size="A3">
				<div class="content-context">
				{#each committedContent as item (item.id)}
					<svelte:component 
						this={item.type} 
						content={item.content} 
						settings={item.settings}
						on:overflow={() => handleOverflow(item)}
					/>
				{/each}
				{#if !$isPrinting && currentSentence?.type}
					<svelte:component 
						bind:this={currentSentenceRef} 
						this={currentSentence.type} 
						content={currentSentence.content} 
						settings={$settings} 
						isCurrent
					/>
				{/if}
				</div>
			</page>
		</div>
	{/if}

	<div class="print-non" class:printFailed={!isSuccessfulPrint}>
		<div class="infobox">
			<div class="dot" class:greenDot={$codeEditorContentSaved}></div>
			<CodeEditor 
				bind:value={$settings.inlineStyle} 
				language="css"
				controllerSettings={$settings.controllerSettings}
				svgFiltersCode={$settings.svgFilters}
				fontFamilys={fontFamilys}
			/>

			<hr>

			<BlockTxt content="Text Preview" settings="{$settings}"/>

			<hr>

			<select bind:value={$settings.fontFamily}>
				{#each fontFamilys as fam}
					<option value={fam}>
						{fam.name}
					</option>
				{/each}
			</select>

			<ControllerManager bind:controllerSettings={$settings.controllerSettings}></ControllerManager>

			<hr>
			<div class="printControls">
			<button on:click="{printFile}">PRINT</button>
			<button on:click="{clearAll}">CLEAR ALL</button>
			<button on:click={() => window.electronAPI.openPDFFolder()}>OPEN PDFs FOLDER</button>
			<input bind:value={printerSettings.deviceName} type="text" disabled>
			<label><input bind:checked={printerSettings.forcePrint} type="checkbox">Force Print</label>
			</div>
			<hr>
			<CodeEditor 
				bind:value={$settings.svgFilters} 
				language="html"
				controllerSettings={$settings.controllerSettings}
				svgFiltersCode={$settings.svgFilters}
			/>
			<div style="display: none">
				{@html $settings.svgFilters}
			</div>
	<!--{#each allIncomingTTSMessages as item}-->
	<!--	<p>{item}</p>-->
	<!--{/each}-->
	<!--<hr>-->
	<TransInfoMessagesLog />
		</div>
	</div>

	<PrintStatusBar bind:this={printStatusBar} />

</main>

<svelte:window />

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
	}
	main {
		text-align: left;
		font-family: "Garamondt-Regular","American Typewriter",monospace;
		display: grid;
		grid-template-columns: 1fr;
		height: 100%;
		padding: 0.5rem;
	}
	page {
		background: white;
		display: block;
		box-shadow: 0 0 0.5cm rgba(0,0,0,0.5);
	}

	page[size="A3"] {
		/*aspect-ratio: 1/1.414;*/
		/*width: 210mm;*/
		/*height: 297mm;*/
		width: calc(297.3mm * 0.86);
		height: calc(420.2mm * 0.895);
		padding: 2cm;
		background: url('../scan.png');
		background-size: 100% 100%;
		outline: 1px solid red;
		position: fixed;
		top: 50%;
		left: 70%;
		transform: translate(-50%, -50%) scale(0.5) translate3d(0,0,0); ;
		z-index: 500;
		contain: strict;

	}
	.print-context {
		text-align: left;
		font-size: 2em;
		font-weight: 100;
		z-index: 500;
		position: fixed;
	}

	:global(h1) {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}
	.infobox {
		font-family: "SpaceMono",serif;
		max-width: 40vw;
		border: 1px solid black;
		margin: 1rem;
		padding: 1rem;
	}
	.content-context {
		height: 100%;
	}
	.content-context:hover {
		outline: 2px solid #00ff00;
	}
	.printControls {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.printFailed {
		background: red;
	}
	
	.dot {
		background: red;
		width: 0.5em;
		height: 0.5em;
		border-radius: 50%;
	}
	.greenDot {
		background: green;
	}

	@media print {
		* {
			print-color-adjust: exact;
			-webkit-print-color-adjust: exact;
		}
		.print-non {
			display: none;
		}
		.print-context {
			width: 100%;
		}
		page[size="A3"] {
			transform: none;
			top: 0;
			left: 0;
			/*scale: 0.5;*/
			/*background: none;*/
		}
		:global(body, page, main) {
			background: white;
			margin: 0;
			padding: 0;
			box-shadow: none;
			display: block;
		}
		:global(span.current) {
			display: none !important;
		}
	}
</style>
