import * as assert from 'assert';
import * as vscode from 'vscode';
import { errorMessage } from '../errorMessage';
import { isRobloxFile, ROBLOX_EXTENSIONS } from '../fileviewUri';
import { buildDumpArgs } from '../fileviewCli';

suite('RBX-Fileview CLI helpers', () => {
	test('buildDumpArgs includes dump target without stats', () => {
		const args = buildDumpArgs('Test/sample.rbxm');

		assert.ok(args.includes('dump'));
		assert.ok(args.includes('Test/sample.rbxm'));
		assert.ok(!args.includes('--stats'));
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
