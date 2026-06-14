import * as path from 'node:path';
import * as vscode from 'vscode';
import { openDumpDiff } from './dumpDiffOpen';
import { errorMessage } from './errorMessage';
import { dumpRobloxFile } from './fileviewCli';
import { fromFileviewUri, isFileviewUri, isRobloxFile, toFileviewUri } from './fileviewUri';
import { robloxFileKey } from './robloxUri';

let compareSource: vscode.Uri | undefined;

export function setCompareSourceContext(active: boolean): void {
	void vscode.commands.executeCommand('setContext', 'rbx-fileview.compareSourceSet', active);
}

function resolveRobloxFileUri(uri: vscode.Uri): vscode.Uri | undefined {
	if (isRobloxFile(uri)) {
		return uri;
	}

	if (isFileviewUri(uri)) {
		return fromFileviewUri(uri);
	}

	return undefined;
}

function diffTitle(left: vscode.Uri, right: vscode.Uri): string {
	return `${path.basename(left.fsPath)} ↔ ${path.basename(right.fsPath)} (RBX-Fileview)`;
}

function toDiffSideUri(fileUri: vscode.Uri, side: 'left' | 'right'): vscode.Uri {
	const params = new URLSearchParams();
	params.set('side', side);
	return toFileviewUri(fileUri).with({ query: params.toString() });
}

async function openRobloxDiff(
	leftFile: vscode.Uri,
	rightFile: vscode.Uri,
	output?: vscode.OutputChannel,
): Promise<void> {
	output?.appendLine(`Opening diff: ${leftFile.fsPath} | ${rightFile.fsPath}`);

	try {
		await openDumpDiff({
			title: diffTitle(leftFile, rightFile),
			progressTitle: 'RBX-Fileview: dumping files for compare',
			progressFiles: [leftFile, rightFile],
			dump: async () =>
				Promise.all([
					dumpRobloxFile(leftFile.fsPath, { spillLabelPath: leftFile.fsPath, spillSuffix: 'compare-left' }),
					dumpRobloxFile(rightFile.fsPath, { spillLabelPath: rightFile.fsPath, spillSuffix: 'compare-right' }),
				]),
			left: {
				fileUri: leftFile,
				suffix: 'compare-left',
				query: new URLSearchParams({ side: 'left' }),
				virtualUri: toDiffSideUri(leftFile, 'left'),
			},
			right: {
				fileUri: rightFile,
				suffix: 'compare-right',
				query: new URLSearchParams({ side: 'right' }),
				virtualUri: toDiffSideUri(rightFile, 'right'),
			},
			output,
		});
	} catch (error) {
		output?.appendLine(`Diff failed: ${errorMessage(error)}`);
		void vscode.window.showErrorMessage(`rbx-fileview diff failed: ${errorMessage(error)}`);
		throw error;
	}
}

export async function selectForCompare(uri?: vscode.Uri): Promise<void> {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	const fileUri = target ? resolveRobloxFileUri(target) : undefined;

	if (!fileUri) {
		void vscode.window.showWarningMessage('Select a Roblox place or model file to compare.');
		return;
	}

	compareSource = fileUri;
	setCompareSourceContext(true);
	void vscode.window.showInformationMessage(`Selected for compare: ${path.basename(fileUri.fsPath)}`);
}

export async function compareWithSelected(uri?: vscode.Uri, output?: vscode.OutputChannel): Promise<void> {
	if (!compareSource) {
		void vscode.window.showWarningMessage('Select a file for compare first (rbx-fileview: Select for Compare).');
		return;
	}

	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	const fileUri = target ? resolveRobloxFileUri(target) : undefined;

	if (!fileUri) {
		void vscode.window.showWarningMessage('Select another Roblox file to compare with.');
		return;
	}

	if (robloxFileKey(fileUri) === robloxFileKey(compareSource)) {
		void vscode.window.showWarningMessage('Choose a different file to compare.');
		return;
	}

	await openRobloxDiff(compareSource, fileUri, output);
}

export async function compareWith(uri?: vscode.Uri, output?: vscode.OutputChannel): Promise<void> {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	const leftFile = target ? resolveRobloxFileUri(target) : undefined;

	if (!leftFile) {
		void vscode.window.showWarningMessage('Open a Roblox place or model file to compare.');
		return;
	}

	const workspaceFolder = vscode.workspace.getWorkspaceFolder(leftFile);
	const defaultUri = workspaceFolder?.uri ?? leftFile;

	const picked = await vscode.window.showOpenDialog({
		canSelectMany: false,
		openLabel: 'Compare',
		defaultUri,
		filters: {
			'Roblox files': ['rbxl', 'rbxlx', 'rbxm', 'rbxmx'],
		},
	});

	const rightFile = picked?.[0];
	if (!rightFile || !isRobloxFile(rightFile)) {
		return;
	}

	if (robloxFileKey(rightFile) === robloxFileKey(leftFile)) {
		void vscode.window.showWarningMessage('Choose a different file to compare.');
		return;
	}

	await openRobloxDiff(leftFile, rightFile, output);
}

export async function compareActiveWith(output?: vscode.OutputChannel): Promise<void> {
	const target = vscode.window.activeTextEditor?.document.uri;
	const leftFile = target ? resolveRobloxFileUri(target) : undefined;

	if (!leftFile) {
		void vscode.window.showWarningMessage('Open a Roblox place or model file to compare.');
		return;
	}

	await compareWith(leftFile, output);
}
