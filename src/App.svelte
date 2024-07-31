<script>
	import inputJson from "../input-defaults/input.json"
	import BlockTxt from "./components/BlockTxt.svelte"
	import BlockImg from "./components/BlockImg.svelte"
	import ControllerManager from "./components/ControllerManager.svelte"
	import CodeEditor from "./components/CodeEditor.svelte"

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
		inlineStyle: `.el {
  display: inline-block;
  //transform: skew(30deg, 2deg);
  line-height: $m2 * 3;
  // filter: drop-shadow(16px 16px 10px black);
  letter-spacing: $m5 * 1px;
  text-decoration: blue wavy underline $m1 * 5px;
  text-shadow: 2px 2px 10px red;
  // text-shadow: 5px 5px #000;
  // text-shadow: 1px 1px 2px red, 0 0 1em blue, 0 0 0.2em blue;

  
  // color: white;
  text-shadow: 1px 1px 4px black, 0 0 1em black, 0 0 10px black;

  // filter: url(#outline);
  font-family: NIKITA-Regular;

  background: rgba($bgR, $bgG, $bgB, $bgA);
  rotate: $r1 * 1deg;
  font-size: $fsz * 1em;
  font-family: NIKITA-Regular;
}

`
	}

	let svgFiltersCode = `<svg>
<filter id="glitch">
	<feTurbulence type="fractalNoise" baseFrequency="0.03 0.01" numOctaves="1" result="warp" id="turb"/>
	<feColorMatrix in="warp" result="huedturb" type="hueRotate" values="90">
	<animate attributeType="XML" attributeName="values" values="0;180;360" dur="6s"
                         repeatCount="indefinite"/>
	</feColorMatrix>
	<feDisplacementMap xChannelSelector="R" yChannelSelector="G" scale="30" in="SourceGraphic" in2="huedturb"/>
</filter>

<filter id="distort">
  <feTurbulence baseFrequency="0.01 0.01" numOctaves="1" result="noise"  />
  <feDisplacementMap in="SourceGraphic" in2="noise" scale="10" xChannelSelector="R" yChannelSelector="R">
</filter>

<filter id="grain">
  <feTurbulence type="turbulence"
    baseFrequency="0.1" numOctaves="2" result="turbulence"/>
  <feDisplacementMap in2="turbulence" in="SourceGraphic"
    scale="10" xChannelSelector="R" yChannelSelector="G" />
</filter>

<filter id="swoot">
	<feTurbulence type="turbulence" baseFrequency="0.015 0.1" numOctaves="2" seed="2" stitchTiles="stitch" x="0%" y="0%" width="100%" height="100%" result="turbulence"/>
	<feDisplacementMap in="SourceGraphic" in2="turbulence" scale="15" xChannelSelector="R" yChannelSelector="B" x="0%" y="0%" width="100%" height="100%" result="displacementMap1"/>
</filter>

<filter id="outline">
      <feMorphology operator="dilate" radius="12" in="SourceGraphic" result="THICKNESS" />
      <feComposite operator="out" in="THICKNESS" in2="SourceGraphic"></feComposite>
</filter>

<filter id="motion-blur">
	<feGaussianBlur in="SourceGraphic" stdDeviation="5,0" />
</filter>

<filter id="blobs" color-interpolation-filters="sRGB" x="-50%" y="-50%" height="200%" width="200%">
	<feOffset id="offset" in="SourceAlpha" dx="0" dy="0" result="SA-offset"/>
	<feGaussianBlur id="blur" in="SA-offset" stdDeviation="5.5" result="SA-o-blur"/>
	<feComponentTransfer in="SA-o-blur" result="SA-o-b-contIN">
	  <feFuncA id="contour" type="table" tableValues="0 0.05 0.15 0.45 0.7 0.85 0.95 1 0.95 0.85 0.7 0.45 0.15 0.05 0 0.05 0.15 0.45 0.7 0.85 0.95 1 0.95 0.85 0.7 0.45 0.15 0.05 0 0.05 0.15 0.45 0.7 0.85 0.95 1"/>
	</feComponentTransfer>
	<feComposite operator="in" in="SA-o-blur" in2="SA-o-b-contIN" result="SA-o-b-cont"/>
	<feComponentTransfer in="SA-o-b-cont" result="SA-o-b-c-sprd">
	  <feFuncA id="spread-ctrl" type="linear" slope="5.1"/>
	</feComponentTransfer>
	<feColorMatrix id="recolor" in="SA-o-b-c-sprd" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="SA-o-b-c-s-recolor"/>
	<feTurbulence result="fNoise" type="fractalNoise" numOctaves="6" baseFrequency="1.98"/>
	<feColorMatrix in="fNoise" type="matrix" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 7 -3" result="clipNoise"/>
	<feComposite id="noisemix" operator="arithmetic" in="SA-o-b-c-s-recolor" in2="clipNoise" k1="0" k2="1" result="SA-o-b-c-s-r-mix"/>
	<feMerge>
	  <feMergeNode in="SA-o-b-c-s-r-mix"/>
	  <feMergeNode in="SourceGraphic"/>
	</feMerge>
</filter>

<filter id="fire" x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
  <feGaussianBlur stdDeviation="0 10" x="0%" y="0%" width="100%" height="100%" in="SourceGraphic" edgeMode="none" result="blur"/>
  <feTurbulence type="turbulence" baseFrequency="0.06 0.015" numOctaves="2" seed="2" stitchTiles="stitch" x="0%" y="0%" width="100%" height="100%" result="turbulence1"/>
  <feColorMatrix type="matrix" values="1 0 0 0 0
0 1 0 0 0
0 0 1 0 0
0 0 0 5 -1" x="0%" y="0%" width="100%" height="100%" in="turbulence1" result="colormatrix2"/>
  <feColorMatrix type="matrix" values="1 0 0 0 0
0 1 0 0 0
0 0 1 0 0
0 0 0 3 0" x="0%" y="0%" width="100%" height="100%" in="turbulence1" result="colormatrix3"/>
  <feComposite in="colormatrix2" in2="blur" operator="in" x="0%" y="0%" width="100%" height="100%" result="composite1"/>
  <feFlood flood-color="#ff853a" flood-opacity="1" x="0%" y="0%" width="100%" height="100%" result="flood1"/>
  <feComposite in="flood1" in2="composite1" operator="in" x="0%" y="0%" width="100%" height="100%" result="composite2"/>
  <feOffset dx="-5" dy="-20" x="0%" y="0%" width="100%" height="100%" in="composite2" result="offset1"/>
  <feMorphology operator="dilate" radius="0 10" x="0%" y="0%" width="100%" height="100%" in="offset1" result="morphology"/>
  <feDisplacementMap in="morphology" in2="turbulence1" scale="20" xChannelSelector="G" yChannelSelector="B" x="0%" y="0%" width="100%" height="100%" result="displacementMap1"/>
  <feComposite in="merge3" in2="colormatrix3" operator="out" x="0%" y="0%" width="100%" height="100%" result="composite3"/>
  <feFlood flood-color="#ff8422" flood-opacity="1" x="0%" y="0%" width="100%" height="100%" result="flood2"/>
  <feComposite in="flood2" in2="composite3" operator="in" x="0%" y="0%" width="100%" height="100%" result="composite4"/>
  <feMerge x="0%" y="0%" width="100%" height="100%" result="merge3">
          <feMergeNode in="displacementMap1"/>
      <feMergeNode in="SourceGraphic"/>
      <feMergeNode in="composite4"/>
  </feMerge>
</filter>

</svg>
`
	let printerSettings = {
		deviceName: 'Xerox_Phaser_5550N',
		forcePrint: true
	}
	let isSuccessfulPrint = true

	let mySynth = null

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

	window.electronAPI.onTransData((event, value) => {
		console.log("New Trans Data: ", value, window.performance.now())
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

	function commitFinalSentence() {
		if (!dontSave.some(x => x.toLowerCase() === currentSentence.content.toLowerCase().trim())) {
			committedContent = [...committedContent, currentSentence]
		}
		// currentSentence = ''
	}

	window.electronAPI.onTransInfo((event, value) => {
		transInfoMessages = [value, ...transInfoMessages]
	})

	window.electronAPI.printSuccess((event, value) => {
		console.log("printSuccess", value)
		if (value === 'pdf' || value=== 'print') {
			clearAll()
			setTimeout(() => {
				isSuccessfulPrint = true
			}, 2000)
		} else if (value === false) {
			console.error("print failed")
			isSuccessfulPrint = false
		}
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

	function onKeyDown(e) {
		codeEditorContentSaved = false
		console.log("codeEditorContentSaved", codeEditorContentSaved)
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

	function printFile() {
		const pageContent = document.querySelector('page').innerHTML;
		window.electronAPI.print({
			content: pageContent,
			settings: {
				...printerSettings,
				silent: true,  // Ensure silent printing
				printBackground: true, // Enable background printing
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
				// Send additional style information
				inlineStyle: settings.inlineStyle,
				svgFiltersCode: svgFiltersCode
			}
		});
	}
	function clearAll() {
		committedContent = []
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

		if (percent < 10) {
			console.log("page full")
			printFile()
			setTimeout(() => {
				clearAll()
			}, 0)
		}
	}
	window.setInterval(isPageFull, 3000)


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
