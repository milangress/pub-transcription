import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import css from 'rollup-plugin-css-only';
import livereload from 'rollup-plugin-livereload';
import svelte from 'rollup-plugin-svelte';
import sveltePreprocess from 'svelte-preprocess';

const production = !process.env.ROLLUP_WATCH;

function serve() {
	let server;

	function toExit() {
		if (server) server.kill(0);
	}

	return {
		writeBundle() {
			if (server) return;
			server = require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
				stdio: ['ignore', 'inherit', 'inherit'],
				shell: true
			});

			process.on('SIGTERM', toExit);
			process.on('exit', toExit);
		}
	};
}

// Export array of configs
export default [
	// Main window config
	{
		input: 'src/main-window/main.ts',
		output: {
			sourcemap: true,
			format: 'iife',
			name: 'app',
			file: 'public/build/bundle.js'
		},
		plugins: [
			svelte({
				preprocess: sveltePreprocess({
					sourceMap: !production,
					typescript: {
						tsconfigFile: './tsconfig.json'
					}
				}),
				compilerOptions: {
					dev: !production
				}
			}),
			css({ output: 'bundle.css' }),
			resolve({
				browser: true,
				dedupe: ['svelte'],
				extensions: ['.mjs', '.js', '.ts', '.json', '.node', '.svelte']
			}),
			commonjs(),
			typescript({
				sourceMap: !production,
				inlineSources: !production,
				tsconfig: './tsconfig.json',
				noEmitOnError: !production,
				outputToFilesystem: false
			}),
			!production && serve(),
			!production && livereload('public'),
			production && terser(),
			json()
		],
		watch: {
			clearScreen: false
		}
	},
	// Print window config
	{
		input: 'src/print-window/print.js',
		output: {
			sourcemap: true,
			format: 'iife',
			name: 'printApp',
			file: 'public/build/print/print.js'
		},
		plugins: [
			svelte({
				compilerOptions: {
					dev: !production
				}
			}),
			css({ output: 'print.css' }),
			resolve({
				browser: true,
				dedupe: ['svelte']
			}),
			commonjs(),
			!production && livereload('public'),
			production && terser(),
			json()
		],
		watch: {
			clearScreen: false
		}
	}
];
