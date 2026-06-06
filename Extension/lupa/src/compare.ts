import * as path from 'node:path';
import * as vscode from 'vscode';
import { beginDiffOperation, endDiffOperation } from './diffGuard';
import { fromLupaUri, isLupaUri, isRobloxFile, toLupaUri } from './lupaUri';

let compareSource: vscode.Uri | undefined;

export function setCompareSourceContext(active: boolean): void {
	void vscode.commands.executeCommand('setContext', 'lupa.compareSourceSet', active);
}

export function resolveRobloxFileUri(uri: vscode.Uri): vscode.Uri | undefined {
	if (isRobloxFile(uri)) {
		return uri;
	}

	if (isLupaUri(uri)) {
		return fromLupaUri(uri);
	}

	return undefined;
}

function diffTitle(left: vscode.Uri, right: vscode.Uri): string {
	return `${path.basename(left.fsPath)} ↔ ${path.basename(right.fsPath)} (Lupa)`;
}

function toDiffSideUri(fileUri: vscode.Uri, side: 'left' | 'right'): vscode.Uri {
	const params = new URLSearchParams();
	params.set('side', side);
	return toLupaUri(fileUri).with({ query: params.toString() });
}

export async function openRobloxDiff(
	leftFile: vscode.Uri,
	rightFile: vscode.Uri,
	output?: vscode.OutputChannel,
): Promise<void> {
	const leftLupa = toDiffSideUri(leftFile, 'left');
	const rightLupa = toDiffSideUri(rightFile, 'right');

	output?.appendLine(`Opening diff: ${leftLupa.toString()} | ${rightLupa.toString()}`);

	beginDiffOperation();
	try {
		await vscode.commands.executeCommand('vscode.diff', leftLupa, rightLupa, diffTitle(leftFile, rightFile), {
			preview: false,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		output?.appendLine(`Diff failed: ${message}`);
		void vscode.window.showErrorMessage(`Lupa diff failed: ${message}`);
		throw error;
	} finally {
		endDiffOperation();
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
		void vscode.window.showWarningMessage('Select a file for compare first (Lupa: Select for Compare).');
		return;
	}

	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	const fileUri = target ? resolveRobloxFileUri(target) : undefined;

	if (!fileUri) {
		void vscode.window.showWarningMessage('Select another Roblox file to compare with.');
		return;
	}

	if (fileUri.toString() === compareSource.toString()) {
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

	if (rightFile.toString() === leftFile.toString()) {
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
