<script xmlns="http://www.w3.org/1999/html">
	import inputJson from "../input-defaults/input.json"
	import BlockTxt from "./components/BlockTxt.svelte"
	import BlockImg from "./components/BlockImg.svelte"
	import { SimpleCodeEditor } from 'svelte-simple-code-editor';
	import Prism from 'prismjs';

	console.log(inputJson)

	let loremIpsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec euismod, nisl nec aliquam ultricies, nunc nisl aliquet nunc, nec aliquam n'

	let dontSave = ['[ Silence ]', '[silence]', '[BLANK_AUDIO]', '[ [ [ [','[ [ [','[ [', '[', '(buzzer)']

	// Only Contains the final sentences
	let committedContent = []

	// Contains all incoming TTS sentences
	let allIncomingTTSMessages = []

	let currentSentence = {}

	// only Info and debug messages
	let transInfoMessages = []

	let settings = {
		fontSize: 1,
		controllerSettings: [...inputJson.controllers],
		inlineStyle: `
background: rgba(1,1,1,0.1);
display: inline-block;
rotate: -3deg;
transform: skew(30deg, 2deg);
line-height: 1.8;
//letter-spacing: 7px;
//text-decoration: green wavy underline;
text-shadow: 2px 2px 10px red;
//text-shadow: 5px 5px #000;
//text-shadow: 1px 1px 2px red, 0 0 1em blue, 0 0 0.2em blue;
`
	}

	$: currentContentList = [...committedContent, currentSentence]

	window.electronAPI.onTransData((event, value) => {
		console.log("onUpdateCounter", value)
		allIncomingTTSMessages = [value, ...allIncomingTTSMessages]
		if (String(value).startsWith('NEW')) {
			commitFinalSentence()
			currentSentence = formatTTSasTxtObject(value)
			return
		} else {
			currentSentence = formatTTSasTxtObject(value)
			console.log("currentSentence", currentSentence)
		}
		// list = [value, ...list]
		console.log("list", committedContent)
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
		const removeNEWKeyword = String(tts).replace('NEW', '')
		return {
			type: BlockTxt,
			content: removeNEWKeyword,
			settings: JSON.parse(JSON.stringify(settings)),
			id: Math.random()
		}

	}

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

</script>

<main>
	{#if currentContentList.length > 0}
		<div class="print-context">
			<page size="A3">
				{#each committedContent as item (item.id)}
					<svelte:component this={item.type} content={item.content} settings="{item.settings}"/>
				{/each}
					<svelte:component this={currentSentence.type} content={currentSentence.content} settings="{settings}" isCurrent/>
			</page>
		</div>
	{/if}

	<div class="print-non">
		<div class="infobox">
			<SimpleCodeEditor
					bind:value="{settings.inlineStyle}"
					highlight={(code) => Prism.highlight(code, Prism.languages.javascript, 'javascript')}
			/>

			<!--			<textarea id="positionX"  rows="10" cols="50" bind:value="{settings.inlineStyle}" ></textarea>-->

			<BlockTxt content="Text Preview" settings="{settings}"/>

			<p>Font size -> <b>{settings.fontSize}</b></p>

			{#each settings.controllerSettings as item}
				<p>{item.name}, {item.var} -> <b>{item.value}</b> (+-{item.step})</p>
			{/each}

			<hr>
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
		outline: 1px solid green;
		display: grid;
		grid-template-columns: 1fr;
		height: 100%;
		padding: 0.5rem;
	}
	page {
		background: white;
		display: block;
		box-shadow: 0 0 0.5cm rgba(0,0,0,0.5);
		contain: paint;
	}

	page[size="A3"] {
		/*aspect-ratio: 1.414/1;*/
		width: 297mm;
		height: 420mm;
		padding: 1cm;
		background: url('../scan.jpeg');
		background-size: contain;
		outline: 1px solid red;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) scale(0.5);
		z-index: 500;

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
		font-family: Arial,serif;
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
