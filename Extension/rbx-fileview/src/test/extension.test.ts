import * as assert from 'assert';
import * as vscode from 'vscode';
import { errorMessage } from '../errorMessage';
import { isRobloxFile, ROBLOX_EXTENSIONS } from '../fileviewUri';
import { buildDumpArgs, DEFAULT_EXCLUDED_PROPERTIES } from '../fileviewCli';

suite('RBX-Fileview CLI helpers', () => {
	test('buildDumpArgs includes dump target without stats', () => {
		const args = buildDumpArgs('Test/sample.rbxm');

		assert.ok(args.includes('dump'));
		assert.ok(args.includes('Test/sample.rbxm'));
		assert.ok(!args.includes('--stats'));
	});

	test('buildDumpArgs passes excluded properties as a comma-separated CLI value', () => {
		const args = buildDumpArgs('Test/sample.rbxm', { excludedProperties: ['Source', 'LinkedSource'] });
		const flagIndex = args.indexOf('--exclude-property');

		assert.ok(flagIndex >= 0);
		assert.strictEqual(args[flagIndex + 1], 'Source,LinkedSource');
	});

	test('buildDumpArgs passes include-default-properties when full is enabled', () => {
		const args = buildDumpArgs('Test/sample.rbxm', { full: true });

		assert.ok(args.includes('--include-default-properties'));
		assert.ok(!args.includes('--full'));
	});

	test('buildDumpArgs omits exclusion flags when the list is empty', () => {
		const args = buildDumpArgs('Test/sample.rbxm', { excludedProperties: [] });

		assert.ok(!args.includes('--no-excluded-properties'));
		assert.ok(!args.includes('--exclude-property'));
	});

	test('default excluded properties are empty', () => {
		assert.deepStrictEqual(DEFAULT_EXCLUDED_PROPERTIES, []);
	});
});

suite('RBX-Fileview URI helpers', () => {
	test('isRobloxFile accepts known Roblox extensions', () => {
		for (const extension of ROBLOX_EXTENSIONS) {
			assert.strictEqual(isRobloxFile(vscode.Uri.file(`C:/game${extension}`)), true);
		}
	});

	test('isRobloxFile rejects non-Roblox files', () => {
		assert.strictEqual(isRobloxFile(vscode.Uri.file('C:/game.txt')), false);
		assert.strictEqual(isRobloxFile(vscode.Uri.parse('rbx-fileview:/Test/sample.rbxm')), false);
	});
});

suite('Error helpers', () => {
	test('errorMessage extracts Error.message', () => {
		assert.strictEqual(errorMessage(new Error('boom')), 'boom');
	});

	test('errorMessage stringifies unknown values', () => {
		assert.strictEqual(errorMessage('plain'), 'plain');
	});
});
