<script>
	import {onMount} from "svelte"

	let dontSave = ['[ Silence ]', '[silence]', '[BLANK_AUDIO]', '[ [ [ [','[ [ [','[ [', '[']

	let list = [];
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
		<div class="maintxt">
			<page size="A4">{compText}</page>
		</div>
	{/if}

	<div class="print-non">
	<hr>
	{#each fullList as item}
		<p>{item}</p>
	{/each}
	<hr>
	{#each transData as item}
		<p>{item}</p>
	{/each}
	</div>
</main>

<style>
	main {
		text-align: left;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
		font-family: "American Typewriter",monospace;
	}
	page {
		background: white;
		display: block;
		margin: 0 auto;
		margin-bottom: 0.5cm;
		box-shadow: 0 0 0.5cm rgba(0,0,0,0.5);
	}
	page[size="A4"] {
		width: 21cm;
		min-height: 29.7cm;
		padding: 1cm;
	}

	.maintxt {
		text-align: left;
		font-size: 2em;
		font-weight: 100;
	}

	h1 {
		color: #ff3e00;
		text-transform: uppercase;
		font-size: 4em;
		font-weight: 100;
	}

	@media (min-width: 640px) {
		main {
			max-width: none;
		}
	}
	@media print {
		* {
			-webkit-print-color-adjust: exact;
		}
		.print-non {
			display: none;
		}
		body, page, main {
			background: white;
			margin: 0;
			padding: 0;
			box-shadow: 0;
		}
	}
</style>
