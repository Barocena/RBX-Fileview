import * as path from 'node:path';
import * as vscode from 'vscode';
import { openDumpDiff } from './dumpDiffOpen';
import { errorMessage } from './errorMessage';
import { dumpRobloxFileAtRef } from './gitRefDump';
import { isRobloxFile, normalizeRobloxFileUri, toFileviewUri } from './fileviewUri';

function toFileviewGitUri(fileUri: vscode.Uri, ref: 'HEAD' | 'WORKTREE'): vscode.Uri {
	const params = new URLSearchParams();
	params.set('ref', ref);
	return toFileviewUri(fileUri).with({ query: params.toString() });
}

export async function openGitChanges(
	uri?: vscode.Uri,
	output?: vscode.OutputChannel,
	options?: { viewColumn?: vscode.ViewColumn },
): Promise<void> {
	const raw = uri ?? vscode.window.activeTextEditor?.document.uri;
	const target = raw ? normalizeRobloxFileUri(raw) : undefined;

	if (!target || !isRobloxFile(target)) {
		void vscode.window.showWarningMessage('Select a changed Roblox place or model file.');
		return;
	}

	const title = `${path.basename(target.fsPath)} (HEAD ↔ Working Tree)`;

	output?.appendLine(`Opening git diff for ${target.fsPath}`);

	try {
		await openDumpDiff({
			title,
			progressTitle: `RBX-Fileview: dumping ${path.basename(target.fsPath)} for diff`,
			progressFiles: [target],
			dump: async () =>
				Promise.all([
					dumpRobloxFileAtRef(target.fsPath, 'HEAD'),
					dumpRobloxFileAtRef(target.fsPath, 'WORKTREE'),
				]),
			left: {
				fileUri: target,
				suffix: 'head',
				query: new URLSearchParams({ ref: 'HEAD' }),
				virtualUri: toFileviewGitUri(target, 'HEAD'),
			},
			right: {
				fileUri: target,
				suffix: 'worktree',
				query: new URLSearchParams({ ref: 'WORKTREE' }),
				virtualUri: toFileviewGitUri(target, 'WORKTREE'),
			},
			viewColumn: options?.viewColumn,
			output,
		});
	} catch (error) {
		output?.appendLine(`Git diff failed: ${errorMessage(error)}`);
		void vscode.window.showErrorMessage(`rbx-fileview git diff failed: ${errorMessage(error)}`);
		throw error;
	}
}
