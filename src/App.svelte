<script>
	import {onMount} from "svelte"

	let loremIpsum = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec euismod, nisl nec aliquam ultricies, nunc nisl aliquet nunc, nec aliquam n'


	let dontSave = ['[ Silence ]', '[silence]', '[BLANK_AUDIO]', '[ [ [ [','[ [ [','[ [', '[', '(buzzer)']

	let list = [loremIpsum];

	let fullList = [];
	let currentSentence = ''


	let transData = []
	$: compList = [currentSentence, ...list]
	$: compText = compList.reverse().join(' ')
	window.electronAPI.onTransData((event, value) => {
		console.log("onUpdateCounter", value)
		fullList = [value, ...fullList]
		if (String(value).startsWith('NEW')) {
			commitFinalSentence()
			currentSentence = String(value).replace('NEW', '')
			return
		} else {
			currentSentence = String(value)
		}
		// list = [value, ...list]
		console.log("list", list)
	})

	function commitFinalSentence() {
		if (!dontSave.some(x => x.toLowerCase() === currentSentence.toLowerCase().trim())) {
			list = [currentSentence, ...list]
		}
		currentSentence = ''
	}

	window.electronAPI.onTransInfo((event, value) => {
		transData = [...transData, value]
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
</script>

<main>
	{#if compText.length > 0}
		<div class="print-context">
			<page size="A3">{compText}</page>
		</div>
	{/if}

	<div class="print-non">
		<div class="infobox">
	<hr>
	{#each fullList as item}
		<p>{item}</p>
	{/each}
	<hr>
	{#each transData as item}
		<p>{item}</p>
	{/each}
		</div>
	</div>
</main>

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
		background: #000;
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
