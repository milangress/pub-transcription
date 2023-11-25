<script>
	import inputJson from "../input-defaults/input.json"
	import BlockTxt from "./components/BlockTxt.svelte"
	import BlockImg from "./components/BlockImg.svelte"
	console.log(inputJson)

	let loremIpsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec euismod, nisl nec aliquam ultricies, nunc nisl aliquet nunc, nec aliquam n'

	let dontSave = ['[ Silence ]', '[silence]', '[BLANK_AUDIO]', '[ [ [ [','[ [ [','[ [', '[', '(buzzer)']

	// Only Contains the final sentences
	let committedContent = [];

	// Contains all incoming TTS sentences
	let allIncomingTTSMessages = [];

	let currentSentence = {}

	// only Info and debug messages
	let transInfoMessages = []

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

	if (!navigator.mediaDevices?.enumerateDevices) {
		console.log("enumerateDevices() not supported.");
	} else {
		// List cameras and microphones.
		navigator.mediaDevices
				.enumerateDevices()
				.then((devices) => {
					devices.forEach((device) => {
						if (device.kind === "audioinput") {
							console.log(`${device.kind}: ${device.label} id = ${JSON.stringify(device)}`);
						}
					});
				})
				.catch((err) => {
					console.error(`${err.name}: ${err.message}`);
				});
	}

	function formatTTSasTxtObject(tts) {
		const removeNEWKeyword = String(tts).replace('NEW', '')
		return {
			type: BlockTxt,
			content: removeNEWKeyword
		}

	}

	function onKeyDown(e) {
		console.log("onKeyDown", e)
		const inputSettings = inputJson.keys[e.key]
		if (inputSettings) {
			eval(`${inputSettings.function}()`);
		}
	}
	function increaseFontSize() {
		console.log("increaseFontSize")
	}
	function addImage() {
		console.log("addImage")
		committedContent = [...committedContent, {
			type: BlockImg,
			content: 'https://picsum.photos/200/300'
		}]
	}
</script>

<main>
	{#if currentContentList.length > 0}
		<div class="print-context">
			<page size="A3">
				{#each committedContent as item}
					<svelte:component this={item.type} content={item.content}/>
				{/each}
					<svelte:component this={currentSentence.type} content={currentSentence.content} isCurrent/>
			</page>
		</div>
	{/if}

	<div class="print-non">
		<div class="infobox">
	<hr>
	{#each allIncomingTTSMessages as item}
		<p>{item}</p>
	{/each}
	<hr>
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
		font-family: "American Typewriter",monospace;
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
	}

	page[size="A3"] {
		aspect-ratio: 1.414/1;
		height: 297mm;
		width: 420mm;
		padding: 1cm;
		background: url('../scan.jpeg');
		background-size: contain;
		outline: 1px solid red;
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%) scale(0.6);
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
		opacity: 0.7;
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
