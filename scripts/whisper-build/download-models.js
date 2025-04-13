import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ROOT_DIR = path.resolve(__dirname, '../..');
const WHISPER_DIR = path.join(ROOT_DIR, 'vendor', 'whisper.cpp');
const MODELS_DIR = path.join(ROOT_DIR, 'resources', 'models');

// Create models directory if it doesn't exist
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

// Models to download (add more as needed)
const models = [
  'small.en-q5_1',
  // Add other models as needed
];

console.log('Downloading whisper models...');

try {
  // Update git submodules if needed
  console.log('Updating git submodules...');
  execSync('git submodule update --init --recursive', {
    stdio: 'inherit',
    cwd: ROOT_DIR,
  });

  // Change to whisper.cpp directory to access the download script
  process.chdir(WHISPER_DIR);

  for (const model of models) {
    console.log(`Downloading ${model}...`);

    // Download directly to our models directory
    // The download script will add the ggml- prefix and .bin extension
    execSync(`bash ./models/download-ggml-model.sh ${model} "${MODELS_DIR}"`, {
      stdio: 'inherit',
    });

    // Verify the file was downloaded
    const expectedPath = path.join(MODELS_DIR, `ggml-${model}.bin`);
    if (fs.existsSync(expectedPath)) {
      console.log(`Model successfully downloaded to ${expectedPath}`);
    } else {
      console.error(`Error: Model file not found at ${expectedPath} after download attempt`);
      throw new Error('Model download failed');
    }
  }

  console.log('All models downloaded successfully!');
} catch (error) {
  console.error('Model download failed:', error);
  process.exit(1);
}
