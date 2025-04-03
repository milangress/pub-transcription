let simulationInterval = null

/**
 * Simulates a real-time transcript stream for development testing purposes.
 * Creates a controlled environment that generates random transcript messages
 * alternating between natural phrases and unwanted segments at specified intervals.
 *
 * @param {BrowserWindow} mainWindow - The Electron main window to send messages to
 * @param {number} [SendMessageEvery=800] - Interval in ms between messages
 * @param {number} [balance=0.2] - Probability (0-1) of generating unwanted segments vs natural phrases
 * @returns {Object} Controller object with start() and stop() methods to manage simulation
 */
function simulatedTranscriptController(mainWindow, SendMessageEvery = 1800, balance = 0.2) {
  // Words that are saved in the printed transcript
  const naturalPhrases = [
    // Complete thoughts
    'I hope you all enjoyed that',
    "Let's continue with some questions",
    'Maybe we can talk about this',
    "That's an interesting point",
    "Let's move on to the next topic",
    'I would like to ask you',
    'Can you tell us more about that',
    'What do you think about',

    // Questions and discussion starters
    'How do you feel about',
    'What are your thoughts on',
    'Could you explain why',
    'Do you believe that',

    // Fragments and transitions
    "Well that's exactly how",
    'Back to our previous point',
    'Speaking of which',
    'As I was saying before',
    'Moving on to',
    'Interesting perspective on',

    // Radio show specific
    "We're going to continue with some music now",
    "Let's take a short break",
    'Back after these messages',
    'Thanks for joining us today',
    'Coming up next',

    // Filler and thinking phrases
    'Um',
    'Well',
    'You know',
    'I mean',
    'Actually',
    'Sort of',
    'Kind of',
    'Like',
    'So basically',
    'The thing is',
    "What I'm trying to say is"
  ]

  // Segments that are typicaly produced by whisper and are ignored by the print preview
  const unwantedSegments = [
    '[ Silence ]',
    '[silence]',
    '[BLANK_AUDIO]',
    '[ [ [ [',
    '[ [ [',
    '[ [',
    '[',
    '(buzzer)',
    '(buzzing)',
    '.'
  ]

  function getRandomMessage() {
    // 20% chance for unwanted segments
    if (Math.random() < balance) {
      return unwantedSegments[Math.floor(Math.random() * unwantedSegments.length)]
    }

    // Generate a more natural sounding message
    const wordCount = Math.floor(Math.random() * 3) + 1 // 1-3 phrases for variety
    const sentence = []
    for (let i = 0; i < wordCount; i++) {
      sentence.push(naturalPhrases[Math.floor(Math.random() * naturalPhrases.length)])
    }
    return sentence.join(' ')
  }

  function simulateStream() {
    // Clear any existing interval
    if (simulationInterval) {
      clearInterval(simulationInterval)
      simulationInterval = null
    }

    let baseTime = Date.now()

    simulationInterval = setInterval(() => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        clearInterval(simulationInterval)
        simulationInterval = null
        return
      }

      const currentTime = Date.now() - baseTime
      const message = getRandomMessage()

      // Every 3-5 messages, send a NEW message
      if (Math.random() < 0.25) {
        mainWindow.webContents.send('transcription-data', `${message}NEW`)
      } else {
        mainWindow.webContents.send('transcription-data', message)
      }
    }, SendMessageEvery)

    // Clean up interval when window is closed or reloaded
    mainWindow.on('closed', () => {
      if (simulationInterval) {
        clearInterval(simulationInterval)
        simulationInterval = null
      }
    })
  }

  return {
    start: simulateStream,
    stop: () => {
      if (simulationInterval) {
        clearInterval(simulationInterval)
        simulationInterval = null
      }
    }
  }
}

module.exports = {
  simulatedTranscriptController
}
