<script xmlns="http://www.w3.org/1999/html">
	import inputJson from "../input-defaults/input.json"
	import BlockTxt from "./components/BlockTxt.svelte"
	import BlockImg from "./components/BlockImg.svelte"
	import { SimpleCodeEditor } from 'svelte-simple-code-editor';
	import Prism from 'prismjs';
	import ControllerManager from "./components/ControllerManager.svelte"

	import CodeMirror from "svelte-codemirror-editor";
	import { css } from "@codemirror/lang-css";


	console.log(inputJson)

	let loremIpsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec euismod, nisl nec aliquam ultricies, nunc nisl aliquet nunc, nec aliquam n'

	let dontSave = ['[ Silence ]', '[silence]', '[BLANK_AUDIO]', '[ [ [ [','[ [ [','[ [', '[', '(buzzer)', '(buzzing)']

	// Only Contains the final sentences
	let committedContent = []

	// Contains all incoming TTS sentences
	let allIncomingTTSMessages = []

	let currentSentence = {}

	// only Info and debug messages
	let transInfoMessages = []

	let fontFamilys = [
		{
			name: 'Garamondt-Regular',
		},
		{
			name: 'American Typewriter',
		},
		{
			name: 'Arial',
		}
	]

	let settings = {
		controllerSettings: [...inputJson.controllers],
		fontFamily: fontFamilys[0],
		inlineStyle: `
background: rgba(1,1,1,0.1);
display: inline-block;
rotate: r1deg;
//transform: skew(30deg, 2deg);
line-height: 1.8;
//filter: blur(3px);
//filter: drop-shadow(16px 16px 10px black);
//letter-spacing: 7px;
//text-decoration: green wavy underline;
text-shadow: 2px 2px 10px red;
//text-shadow: 5px 5px #000;
//text-shadow: 1px 1px 2px red, 0 0 1em blue, 0 0 0.2em blue;
font-size:fszem;
`
	}

	let mySynth = null


	$: currentContentList = [...committedContent, currentSentence]

	window.electronAPI.onTransData((event, value) => {
		console.log("New Trans Data: ", value)
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
		currentSentence = ''
	}

	window.electronAPI.onTransInfo((event, value) => {
		transInfoMessages = [...transInfoMessages, value]
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
			});
			window.setTimeout(() => {
				console.log('set synth')
				console.log("mySynth", mySynth)

				if (mySynth) {
					mySynth.channels[1].addListener("controlchange", e => {
						if (e.controller.number === controller.knobNR) {
							// console.log("e", e)
							// console.log("controller", controller)
							// console.log("settings", settings.controllerSettings)
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
		const inputSettings = inputJson.keys[e.key]
		if (inputSettings) {
			eval(`${inputSettings.function}()`)
		}
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
		window.electronAPI.print('test')
	}
	function clearAll() {
		committedContent = []
	}

	function isPageFull() {
		let page = document.getElementsByTagName('page')[0]
		const {height: pageHeight, y: pageY} = page.getBoundingClientRect()
		const pageBottom = pageHeight + pageY
		const {height: contentHeight, y: contentY} = document.getElementsByClassName('current')[0].getBoundingClientRect()
		const contentBottom = contentHeight + contentY
		const distance = pageBottom - contentBottom
		const percent = (distance / pageHeight) * 100
		// console.log("distance", distance, percent)

		if (percent < 10) {
			console.log("page full")
			printFile()
			setTimeout(() => {
				clearAll()
			}, 1000)
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

		// const mySynth = WebMidi.getInputByName("TYPE NAME HERE!")

		// mySynth.channels[1].addListener("noteon", e => {
		// 	console.log(`${e.note.name}`)
		// });
		// mySynth.channels[1].addListener("controlchange", e => {
		// 	console.log(e)
		// });

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
					<svelte:component this={currentSentence.type} content={currentSentence.content} settings="{settings}" isCurrent/>
				</div>
			</page>
		</div>
	{/if}

	<div class="print-non">
		<div class="infobox">
			<CodeMirror bind:value={settings.inlineStyle} lang={css()}/>

<!--			<SimpleCodeEditor-->
<!--					bind:value="{settings.inlineStyle}"-->
<!--					highlight={(code) => Prism.highlight(code, Prism.languages.javascript, 'javascript')}-->
<!--			/>-->

			<!--			<textarea id="positionX"  rows="10" cols="50" bind:value="{settings.inlineStyle}" ></textarea>-->

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
			<button on:click="{printFile}">PRINT</button>
			<button on:click="{clearAll}">CLEAR ALL</button>
	<!--{#each allIncomingTTSMessages as item}-->
	<!--	<p>{item}</p>-->
	<!--{/each}-->
	<!--<hr>-->
	<!--{#each transInfoMessages as item}-->
	<!--	<p>{item}</p>-->
	<!--{/each}-->
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
		/*aspect-ratio: 1.414/1;*/
		/*width: 210mm;*/
		/*height: 297mm;*/
		width: 297mm;
		height: 420mm;
		padding: 2cm;
		background: url('../scan.jpeg');
		background-size: contain;
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

	@media print {
		* {
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
			background: none;
		}
		body, page, main {
			background: white;
			margin: 0;
			padding: 0;
			box-shadow: none;
			display: block;
		}
	}
</style>
