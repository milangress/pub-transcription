let simulationInterval = null;

function simulatedTranscriptController(mainWindow, SendMessageEvery = 800, balance = 0.2) {
    // Words that are saved in the printed transcript
    const loremWords = [
        "Lorem", "ipsum", "dolor", "sit", "amet", "consectetur", "adipiscing", "elit",
        "Sed", "do", "eiusmod", "tempor", "incididunt", "ut", "labore", "et", "dolore",
        "magna", "aliqua", "Ut", "enim", "ad", "minim", "veniam", "quis", "nostrud",
        "exercitation", "ullamco", "laboris", "nisi", "ut", "aliquip", "ex", "ea",
        "commodo", "consequat"
    ];

    // Segments that are typicaly produced by whisper and are ignored by the print preview
    const unwantedSegments = [
        '[ Silence ]', '[silence]', '[BLANK_AUDIO]', '[ [ [ [', '[ [ [', '[ [', '[',
        '(buzzer)', '(buzzing)', '.'
    ];

    function getRandomMessage() {
        // 20% chance for unwanted segments
        if (Math.random() < balance) {
            return unwantedSegments[Math.floor(Math.random() * unwantedSegments.length)];
        }

        // Generate a random sentence from lorem words
        const wordCount = Math.floor(Math.random() * 6) + 1;
        const sentence = [];
        for (let i = 0; i < wordCount; i++) {
            sentence.push(loremWords[Math.floor(Math.random() * loremWords.length)]);
        }
        return sentence.join(' ');
    }

    function simulateStream() {
        // Clear any existing interval
        if (simulationInterval) {
            clearInterval(simulationInterval);
            simulationInterval = null;
        }

        let baseTime = Date.now();

        simulationInterval = setInterval(() => {
            if (!mainWindow || mainWindow.isDestroyed()) {
                clearInterval(simulationInterval);
                simulationInterval = null;
                return;
            }

            const currentTime = Date.now() - baseTime;
            const message = getRandomMessage();
            
            // Every 3-5 messages, send a NEW message
            if (Math.random() < 0.25) {
                mainWindow.webContents.send('transcription-data', `${message}NEW`);
            } else {
                mainWindow.webContents.send('transcription-data', message);
            }
        }, SendMessageEvery);

        // Clean up interval when window is closed or reloaded
        mainWindow.on('closed', () => {
            if (simulationInterval) {
                clearInterval(simulationInterval);
                simulationInterval = null;
            }
        });
    }

    return {
        start: simulateStream,
        stop: () => {
            if (simulationInterval) {
                clearInterval(simulationInterval);
                simulationInterval = null;
            }
        }
    };
}

module.exports = {
    simulatedTranscriptController
}; 