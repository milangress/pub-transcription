import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

// Get dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const ROOT_DIR = path.resolve(__dirname, '../..');
const WHISPER_DIR = path.join(ROOT_DIR, 'vendor', 'whisper.cpp');
const LIB_DIR = path.join(ROOT_DIR, 'resources', 'lib');

// Create resources/lib directory if it doesn't exist
if (!fs.existsSync(LIB_DIR)) {
  fs.mkdirSync(LIB_DIR, { recursive: true });
}

// Platform-specific configurations
const platform = os.platform();
console.log(`Building whisper-stream for ${platform}...`);

try {
  // Update git submodules if needed
  console.log('Updating git submodules...');
  execSync('git submodule update --init --recursive', {
    stdio: 'inherit',
    cwd: ROOT_DIR,
  });
  execSync('git submodule update --remote', {
    stdio: 'inherit',
    cwd: ROOT_DIR,
  });
  execSync('git diff --submodule', {
    stdio: 'inherit',
    cwd: ROOT_DIR,
  });

  // Change to whisper.cpp directory
  process.chdir(WHISPER_DIR);

  // Build based on platform
  if (platform === 'darwin') {
    // macOS
    // macOS special handling for C++ include path if needed
    const cplusplusPath = '/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/c++/v1';
    if (fs.existsSync(cplusplusPath)) {
      process.env.CPLUS_INCLUDE_PATH = cplusplusPath;
    }

    execSync('cmake -B build -DWHISPER_SDL2=ON', { stdio: 'inherit' });
    execSync('cmake --build build --config Release', { stdio: 'inherit' });

    // Copy binary to the resources/lib directory
    fs.copyFileSync(
      path.join(WHISPER_DIR, 'build', 'bin', 'whisper-stream'),
      path.join(LIB_DIR, 'whisper-stream'),
    );

    // Make executable
    execSync(`chmod +x "${path.join(LIB_DIR, 'whisper-stream')}"`, { stdio: 'inherit' });
  } else if (platform === 'linux') {
    // Linux
    execSync('cmake -B build -DWHISPER_SDL2=ON', { stdio: 'inherit' });
    execSync('cmake --build build --config Release', { stdio: 'inherit' });

    // Copy binary to the resources/lib directory
    fs.copyFileSync(
      path.join(WHISPER_DIR, 'build', 'bin', 'whisper-stream'),
      path.join(LIB_DIR, 'whisper-stream'),
    );

    // Make executable
    execSync(`chmod +x "${path.join(LIB_DIR, 'whisper-stream')}"`, { stdio: 'inherit' });
  } else if (platform === 'win32') {
    // Windows
    execSync('cmake -B build -DWHISPER_SDL2=ON', { stdio: 'inherit' });
    execSync('cmake --build build --config Release', { stdio: 'inherit' });

    // Copy binary to the resources/lib directory
    fs.copyFileSync(
      path.join(WHISPER_DIR, 'build', 'bin', 'Release', 'whisper-stream.exe'),
      path.join(LIB_DIR, 'whisper-stream.exe'),
    );

    // Copy SDL2.dll if needed
    try {
      const sdlDllPath = path.join(WHISPER_DIR, 'build', 'bin', 'Release', 'SDL2.dll');
      if (fs.existsSync(sdlDllPath)) {
        fs.copyFileSync(sdlDllPath, path.join(LIB_DIR, 'SDL2.dll'));
      }
    } catch (err) {
      console.warn('SDL2.dll not found. You may need to copy it manually.', err);
    }
  }

  console.log('Build completed successfully!');
  console.log(
    `Binary located at: ${path.join(LIB_DIR, platform === 'win32' ? 'whisper-stream.exe' : 'whisper-stream')}`,
  );
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
