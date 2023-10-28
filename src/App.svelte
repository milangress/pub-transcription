<script>
	import {onMount} from "svelte"

	let dontSave = ['[ Silence ]', '[silence]', '[BLANK_AUDIO]']

	let list = [1,2,3];
	let currentSentence = ''

	let transData = []
	$: compList = [currentSentence, ...list]
	$: compText = compList.reverse().join(' ')
	window.electronAPI.onTransData((event, value) => {
		console.log("onUpdateCounter", value)
		if (String(value).startsWith('NEW')) {
			if (!dontSave.includes(currentSentence)) {
				list = [currentSentence, ...list]
			}
			currentSentence = String(value).replace('NEW', '')
			return
		} else {
			currentSentence = String(value)
		}
		// list = [value, ...list]
		console.log("list", list)
	})
	window.electronAPI.onTransInfo((event, value) => {
		transData = [...transData, value]
	})
</script>

<main>
	<div class="maintxt">
	<p>{compText}</p>
	</div>
	<hr>
	{#each compList as item}
		<p>{item}</p>
	{/each}
	{#each transData as item}
		<p>{item}</p>
	{/each}
</main>

<style>
	main {
		text-align: center;
		padding: 1em;
		max-width: 240px;
		margin: 0 auto;
		font-family: "American Typewriter",monospace;
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
</style>
