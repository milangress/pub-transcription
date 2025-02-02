<script>
	import inputJson from "../../input-defaults/input.json"
	import defaultSvgFilters from "../../input-defaults/svgFilters.js"
	import defaultInlineStyle from "../../input-defaults/inlineStyle.js"
	
	import BlockTxt from "./components/pageElement/BlockTxt.svelte"
	import BlockImg from "./components/pageElement/BlockImg.svelte"
	import ControllerManager from "./components/midi/ControllerManager.svelte"
	import CodeEditor from "./components/CodeEditor.svelte"
	import PrintStatusBar from './components/PrintStatusBar.svelte'
	import { onMount } from 'svelte'

	console.log(inputJson)

	let loremIpsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec euismod, nisl nec aliquam ultricies, nunc nisl aliquet nunc, nec aliquam n'

	let dontSave = ['[ Silence ]', '[silence]', '[BLANK_AUDIO]', '[ [ [ [','[ [ [','[ [', '[', '(buzzer)', '(buzzing)', '.']

	// Only Contains the final sentences
	let committedContent = []

	// Contains all incoming TTS sentences
	let allIncomingTTSMessages = []

	let currentSentence = {}

	// only Info and debug messages
	let transInfoMessages = []

	let codeEditorContentSaved = false
	
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

	let settings = {
		controllerSettings: [...inputJson.controllers],
		fontFamily: fontFamilys[0],
		inlineStyle: defaultInlineStyle
	}

	let svgFiltersCode = defaultSvgFilters

	let printerSettings = {
		deviceName: 'Xerox_Phaser_5550N',
		forcePrint: false
	}
	let isSuccessfulPrint = true

	let mySynth = null

	let printStatusBar;

	async function initSave() {
		console.log("initSave")
		const inlineStyle = await window.electronAPI.getStoreValue('inlineStyle')
		if (inlineStyle) {
			console.log('found inlineStyle')
			settings.inlineStyle = inlineStyle
		}
		const svgFilters = await window.electronAPI.getStoreValue('svgFilters')
		if (svgFilters) {
			console.log('found svgFilters')
			svgFiltersCode = svgFilters
		}
	}
	initSave()

	async function saveInlineStyle() {
		await window.electronAPI.setStoreValue('inlineStyle', settings.inlineStyle)
		await window.electronAPI.setStoreValue('svgFilters', svgFiltersCode)
		codeEditorContentSaved = true
		console.log("codeEditorContentSaved", codeEditorContentSaved)
	}

	function debounce(func, delay) {
		let timeout;
		return function(...args) {
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(this, args), delay);
		};
	}
	const debouncedSave = debounce(() => {
    console.log("debounced")
    saveInlineStyle()
}, 1000)



	$: currentContentList = [...committedContent, currentSentence]

	window.electronAPI.onTranscriptionData((event, value) => {
		// console.log("New Trans Data: ", value, window.performance.now())
		allIncomingTTSMessages = [value, ...allIncomingTTSMessages]
		if (String(value).endsWith('NEW')) {
			currentSentence = formatTTSasTxtObject(value)
			commitFinalSentence()
			return
		} else {
			currentSentence = formatTTSasTxtObject(value)
			// console.log("currentSentence", currentSentence)
		}
		// list = [value, ...list]
		// console.log("list", committedContent)
	})

	function formatTTSasTxtObject(tts) {
		const removeNEWKeyword = String(tts).replace('NEW', '').trim()
		return {
			type: BlockTxt,
			content: removeNEWKeyword,
			settings: JSON.parse(JSON.stringify(settings)),
			id: Math.random()
		}
	}

	function commitFinalSentence() {
		if (!dontSave.some(x => x.toLowerCase() === currentSentence.content.toLowerCase().trim())) {
			committedContent = [...committedContent, currentSentence]
		}
		// currentSentence = ''
	}

	window.electronAPI.onTranscriptionStatus((event, value) => {
		transInfoMessages = [value, ...transInfoMessages]
	})

	const mapRange = (value, x1, y1, x2, y2) => (value - x1) * (y2 - x2) / (y1 - x1) + x2;

	function setupControllers() {
		inputJson.controllers.forEach((controller) => {
			console.log("controller", controller)
			window.addEventListener("keydown", (event) => {
				if(false) {
					if (event.key === controller.keys.up) {
						console.log("up")
						console.log("settings", settings.controllerSettings)
						const sett = settings.controllerSettings.find((elm) => elm.name === controller.name)
						sett.value += controller.step
						sett.value = Number.parseFloat(sett.value.toFixed(1))
						settings = settings
					} else if (event.key === controller.keys.down) {
						console.log("down")
						const sett = settings.controllerSettings.find((elm) => elm.name === controller.name)
						sett.value -= controller.step
						sett.value = Number.parseFloat(sett.value.toFixed(1))
						settings = settings
					}
				}
			});
			window.setTimeout(() => {
				console.log('set synth')
				console.log("mySynth", mySynth)

				if (mySynth) {
					mySynth.channels[1].addListener("controlchange", e => {
						if (e.controller.number === controller.knobNR) {
							const sett = settings.controllerSettings.find((elm) => elm.name === controller.name)
							// console.log(e.value, controller.range[1])
							const value = mapRange(e.value, 0, 1, controller.range[0], controller.range[1])
							sett.value = Number.parseFloat(value.toFixed(2))
							settings = settings
						}
					});
				}
			}, 5000)
		})
	}
	setupControllers()

	

	async function printFile() {
		console.log("🖨️ Starting print process");
		const pageElement = document.querySelector('page');
		if (!pageElement) {
			console.error('❌ No page element found');
			isSuccessfulPrint = false;
			return;
		}

		const pageContent = pageElement.innerHTML;
		if (!pageContent || typeof pageContent !== 'string') {
			console.error('❌ Invalid page content');
			isSuccessfulPrint = false;
			return;
		}

		try {
			// First create a print request in the status bar
			const printId = printStatusBar.addPrintRequest();
			console.log(`📝 Created print request with ID: ${printId}`);
			
			console.log("pageContent", pageContent);

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
				inlineStyle: settings.inlineStyle,
				svgFiltersCode: svgFiltersCode,
				printId
			};
			
			await window.electronAPI.print(pageContent, printSettings);

			// Clear the content immediately after queuing the print job
			// This prevents double printing and overflow
			console.log("🗑️ Clearing content after print queue");
			clearAll();

		} catch (error) {
			console.error('❌ Print error:', error);
			isSuccessfulPrint = false;
		}
	}


	function isPageFull() {
		let page = document.getElementsByTagName('page')[0]
		if (!page) return;
		
		const currentElement = document.getElementsByClassName('current')[0]
		if (!currentElement) return;

		const {height: pageHeight, y: pageY} = page.getBoundingClientRect()
		const pageBottom = pageHeight + pageY
		const {height: contentHeight, y: contentY} = currentElement.getBoundingClientRect()
		const contentBottom = contentHeight + contentY
		const distance = pageBottom - contentBottom
		const percent = (distance / pageHeight) * 100

		console.log("Page space check:", { percent, distance, pageBottom, contentBottom });

		if (percent < 10) {
			console.log("🖨️ Page is full! Triggering print...");
			printFile()
		}
	}

	// Check page fullness every 3 seconds
	onMount(() => {
		const pageCheckInterval = setInterval(isPageFull, 3000);
		
		return () => {
			clearInterval(pageCheckInterval);
		};
	});

	function clearAll() {
		console.log("🗑️ Clearing all content");
		committedContent = []
	}

	function onKeyDown(e) {
		codeEditorContentSaved = false
		const inputSettings = inputJson.keys[e.key]
		if (inputSettings) {
			eval(`${inputSettings.function}()`)
		}
		debouncedSave()
	}

	function increaseFontSize() {
		const newFontSize = settings.fontSize + 0.1
		settings.fontSize = Number.parseFloat(newFontSize.toFixed(1))
	}

	function decreaseFontSize() {
		const newFontSize = settings.fontSize - 0.1
		settings.fontSize = Number.parseFloat(newFontSize.toFixed(1))
	}

	function addImage() {
		console.log("addImage")
		committedContent = [...committedContent, {
			type: BlockImg,
			content: 'https://picsum.photos/200/300',
			id: Math.random()
		}]
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
	<!--<svg id="filters">
		<defs>
			<filter id="threshold">
				<feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 255 -140" />
			</filter>
		</defs>
	</svg>-->
	{#if currentContentList.length > 0}
		<div class="print-context">
			<page size="A3">
				<div class="content-context">
				{#each committedContent as item (item.id)}
					<svelte:component this={item.type} content={item.content} settings="{item.settings}"/>
				{/each}
					<svelte:component bind:this={currentSentenceRef} this={currentSentence.type} content={currentSentence.content} settings="{settings}" isCurrent/>
				</div>
			</page>
		</div>
	{/if}

	<div class="print-non" class:printFailed={!isSuccessfulPrint}>
		<div class="infobox">
			<div class="dot" class:greenDot={codeEditorContentSaved}></div>
			<CodeEditor 
				bind:value={settings.inlineStyle} 
				language="css"
				controllerSettings={settings.controllerSettings}
				svgFiltersCode={svgFiltersCode}
				fontFamilys={fontFamilys}
			/>

			<hr>

			<BlockTxt content="Text Preview" settings="{settings}"/>

			<hr>

			<select bind:value={settings.fontFamily}>
				{#each fontFamilys as fam}
					<option value={fam}>
						{fam.name}
					</option>
				{/each}
			</select>

			<ControllerManager bind:controllerSettings="{settings.controllerSettings}"></ControllerManager>

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
				bind:value={svgFiltersCode} 
				language="html"
				controllerSettings={settings.controllerSettings}
				svgFiltersCode={svgFiltersCode}
			/>
			<div style="display: none">
				{@html svgFiltersCode}
			</div>
	<!--{#each allIncomingTTSMessages as item}-->
	<!--	<p>{item}</p>-->
	<!--{/each}-->
	<!--<hr>-->
	{#each transInfoMessages as item}
		<p>{item}</p>
	{/each}
		</div>
	</div>

	<PrintStatusBar bind:this={printStatusBar} />

</main>

<svelte:window on:keydown={onKeyDown} />

<style>
	html, body {
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

	h1 {
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
		body, page, main {
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
