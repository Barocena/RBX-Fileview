import * as path from 'node:path';
import * as vscode from 'vscode';
import { openDumpDiff } from './dumpDiffOpen';
import { errorMessage } from './errorMessage';
import { dumpRobloxFileAtRef, type GitRef } from './gitRefDump';
import { isRobloxFile, normalizeRobloxFileUri, toFileviewGitUri } from './fileviewUri';

function refLabel(ref: GitRef): string {
	if (ref === 'WORKTREE') {
		return 'Working Tree';
	}

	if (ref === 'HEAD') {
		return 'HEAD';
	}

	if (ref === 'INDEX') {
		return 'Index';
	}

	return ref.length > 8 ? `${ref.slice(0, 8)}…` : ref;
}

function spillSuffixForRef(ref: GitRef): string {
	if (ref === 'WORKTREE') {
		return 'worktree';
	}

	if (ref === 'HEAD') {
		return 'head';
	}

	if (ref === 'INDEX') {
		return 'index';
	}

	return ref.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 24);
}

export async function openGitRefsDiff(
	fileUri: vscode.Uri,
	leftRef: GitRef,
	rightRef: GitRef,
	output?: vscode.OutputChannel,
	options?: { viewColumn?: vscode.ViewColumn },
): Promise<void> {
	const target = normalizeRobloxFileUri(fileUri);

	if (!isRobloxFile(target)) {
		void vscode.window.showWarningMessage('Select a Roblox place or model file.');
		return;
	}

	const title = `${path.basename(target.fsPath)} (${refLabel(leftRef)} ↔ ${refLabel(rightRef)})`;

	output?.appendLine(`Opening git diff for ${target.fsPath} (${leftRef} ↔ ${rightRef})`);

	try {
		await openDumpDiff({
			title,
			progressTitle: `RBX-Fileview: dumping ${path.basename(target.fsPath)} for diff`,
			progressFiles: [target],
			dump: async () =>
				Promise.all([
					dumpRobloxFileAtRef(target.fsPath, leftRef),
					dumpRobloxFileAtRef(target.fsPath, rightRef),
				]),
			left: {
				fileUri: target,
				suffix: spillSuffixForRef(leftRef),
				virtualUri: toFileviewGitUri(target, leftRef),
			},
			right: {
				fileUri: target,
				suffix: spillSuffixForRef(rightRef),
				virtualUri: toFileviewGitUri(target, rightRef),
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

	await openGitRefsDiff(target, 'HEAD', 'WORKTREE', output, options);
}
