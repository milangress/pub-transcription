
# A (radio) live transcription livecoding VJ PDF printing tool

- streams audio from the microphone
- transcribes the audio
- places the transcription on a3 page
- every incoming transcription can be individualy styled with css
- additiionaly with a custom svg filter
- custom variables with a midi bridge
- full page gets autamtically printed and saved to pdf



## css and svg filter editor (codemirror 6)

- `ctrl + /` toggles line comments
- `shift + alt + a` toggles block comments
- `Ctrl-Space` triggers completions

https://codemirror.net/6/docs/ref/#autocomplete

### livecoding interface (planned)

as a next step i would like to create a custom livecoding system where you have traditional livecodyn controlls:

- `CTRL-Enter` runs a line of code
- `CTRL-Shift-Enter` runs all code on screen
- `ALT-Enter` runs a block (in this case just css lines without a empty line between them)

runing lines would be highlighted by blue background

it always applys the last version of a css property. so when you run a line it checks if the property is already set and if so it overwrites it. unmarking the old line that was overwritten.

so markd lines represent the current state of the css.

running all would mean that it finds and runs all css lines but only actually applies the last version of a css property.

maybe even auto run mode where if you type a new property it automaticla chacks if sutch a property is already set and if so unmarks the old line and marks the new one.

edit maybe running & marking Vs. unrunnnig & unmarking jst means that lines get commented out or reactivated.

### custom completions

- `$` will complete all custom MIDI controller variables
- `filter: url(#` will complete and preview all svg filter ids
- `font-family: ` will complete all valable font family names


## transcription

The transcription runs on a custom whisper.ccp version. It runs OpenAI's Whisper on the apple metal engine. naive example of performing real-time inference on audio from your microphone. The stream tool samples the audio every half a second and runs the transcription continously

https://github.com/milangress/whisper.cpp-milan/blob/master/examples/stream/stream.cpp