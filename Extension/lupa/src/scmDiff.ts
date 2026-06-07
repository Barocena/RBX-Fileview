import * as path from 'node:path';
import * as vscode from 'vscode';
import { beginDiffOperation, endDiffOperation } from './diffGuard';
import { errorMessage } from './errorMessage';
import { isRobloxFile, normalizeRobloxFileUri, toLupaUri } from './lupaUri';

function toLupaGitUri(fileUri: vscode.Uri, ref: 'HEAD' | 'WORKTREE'): vscode.Uri {
	const params = new URLSearchParams();
	params.set('ref', ref);
	return toLupaUri(fileUri).with({ query: params.toString() });
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

	const left = toLupaGitUri(target, 'HEAD');
	const right = toLupaGitUri(target, 'WORKTREE');
	const title = `${path.basename(target.fsPath)} (HEAD ↔ Working Tree)`;

	output?.appendLine(`Opening git diff: ${left.toString()} | ${right.toString()}`);

	beginDiffOperation();
	try {
		await vscode.commands.executeCommand('vscode.diff', left, right, title, {
			preview: false,
			viewColumn: options?.viewColumn,
		});
	} catch (error) {
		output?.appendLine(`Git diff failed: ${errorMessage(error)}`);
		void vscode.window.showErrorMessage(`Lupa git diff failed: ${errorMessage(error)}`);
		throw error;
	} finally {
		endDiffOperation();
	}
}
