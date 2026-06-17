import * as assert from 'assert';
import * as vscode from 'vscode';
import { errorMessage } from '../errorMessage';
import { isRobloxFile, ROBLOX_EXTENSIONS, formatRefForDisplay, getFileviewGitRef, toFileviewGitUri } from '../fileviewUri';
import { buildDumpArgs, DEFAULT_EXCLUDED_PROPERTIES } from '../fileviewCli';
import { isLargeDump, VSCODE_VIRTUAL_DOC_LIMIT_BYTES } from '../dumpLimits';
import { gitRefFromGitUri, normalizeGitRef, parseGitUri } from '../robloxUri';

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

	test('buildDumpArgs passes --no-properties when includeProperties is disabled', () => {
		const args = buildDumpArgs('Test/sample.rbxm', { includeProperties: false });

		assert.ok(args.includes('--no-properties'));
	});

	test('buildDumpArgs omits exclusion flags when the list is empty', () => {
		const args = buildDumpArgs('Test/sample.rbxm', { excludedProperties: [] });

		assert.ok(!args.includes('--exclude-property'));
	});

	test('default excluded properties are empty', () => {
		assert.deepStrictEqual(DEFAULT_EXCLUDED_PROPERTIES, []);
	});

	test('isLargeDump treats dumps above 45MB as large', () => {
		assert.strictEqual(isLargeDump(VSCODE_VIRTUAL_DOC_LIMIT_BYTES), false);
		assert.strictEqual(isLargeDump(VSCODE_VIRTUAL_DOC_LIMIT_BYTES + 1), true);
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

suite('Git URI helpers', () => {
	test('normalizeGitRef maps VS Code git refs', () => {
		assert.strictEqual(normalizeGitRef(undefined), 'WORKTREE');
		assert.strictEqual(normalizeGitRef(''), 'WORKTREE');
		assert.strictEqual(normalizeGitRef('HEAD'), 'HEAD');
		assert.strictEqual(normalizeGitRef('~'), 'INDEX');
		assert.strictEqual(normalizeGitRef('abc123def'), 'abc123def');
	});

	test('parseGitUri reads path and ref from JSON query', () => {
		const uri = vscode.Uri.parse(
			'git:/c%3A/game/Test/sample.rbxm?{"path":"c:/game/Test/sample.rbxm","ref":"abc123"}',
		);
		const parsed = parseGitUri(uri);

		assert.ok(parsed);
		assert.strictEqual(parsed?.path, 'c:/game/Test/sample.rbxm');
		assert.strictEqual(parsed?.ref, 'abc123');
	});

	test('gitRefFromGitUri returns normalized ref', () => {
		const uri = vscode.Uri.parse(
			'git:/c%3A/game/Test/sample.rbxm?{"path":"c:/game/Test/sample.rbxm","ref":"~"}',
		);

		assert.strictEqual(gitRefFromGitUri(uri), 'INDEX');
	});
});

suite('Fileview git URI helpers', () => {
	test('formatRefForDisplay shortens long commit hashes', () => {
		assert.strictEqual(formatRefForDisplay('abc123def456'), 'abc123de…');
		assert.strictEqual(formatRefForDisplay('HEAD'), 'HEAD');
	});

	test('toFileviewGitUri encodes revision metadata for tab labels', () => {
		const uri = toFileviewGitUri(vscode.Uri.file('C:/game/Test/sample.rbxm'), 'abc123def456');

		assert.strictEqual(uri.authority, 'abc123de…');
		assert.strictEqual(getFileviewGitRef(uri), 'abc123def456');
		assert.strictEqual(JSON.parse(uri.query).basename, 'sample.rbxm');
	});

	test('toFileviewGitUri omits revision metadata for worktree', () => {
		const uri = toFileviewGitUri(vscode.Uri.file('C:/game/Test/sample.rbxm'), 'WORKTREE');

		assert.strictEqual(uri.authority, '');
		assert.strictEqual(uri.query, '');
		assert.strictEqual(getFileviewGitRef(uri), 'WORKTREE');
	});
});
