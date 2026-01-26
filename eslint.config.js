import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
	{
		ignores: [
			'.svelte-kit/**',
			'build/**',
			'dist/**',
			'node_modules/**',
			'src-tauri/target/**',
			'src/lib/components/ui/**'
		]
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...svelte.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			}
		},
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_'
				}
			]
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: ts.parser,
				projectService: true,
				extraFileExtensions: ['.svelte'],
				svelteConfig,
				svelteFeatures: {
					runes: true
				}
			}
		}
	},
	{
		files: ['**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser,
				projectService: true,
				svelteFeatures: {
					runes: true
				}
			}
		}
	}
);
