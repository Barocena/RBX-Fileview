import * as vscode from 'vscode';
import { isInDiffContext } from './diffGuard';
import { isLupaUri, isRobloxFile, normalizeRobloxFileUri, toLupaUri } from './lupaUri';

const openedLupaFor = new Set<string>();

async function applyDumpLanguage(document: vscode.TextDocument): Promise<void> {
	if (!isLupaUri(document.uri)) {
		return;
	}

	const format = vscode.workspace.getConfiguration('lupa').get<'yaml' | 'tree'>('dumpFormat', 'yaml');
	const languageId = format === 'yaml' ? 'yaml' : 'plaintext';

	if (document.languageId !== languageId) {
		await vscode.languages.setTextDocumentLanguage(document, languageId);
	}
}

export async function openLupaDocument(
	fileUri: vscode.Uri,
	output?: vscode.OutputChannel,
	showOptions?: vscode.TextDocumentShowOptions,
): Promise<void> {
	const normalized = normalizeRobloxFileUri(fileUri);
	const lupaUri = toLupaUri(normalized);
	output?.appendLine(`Opening Lupa document: ${lupaUri.toString()}`);

	const document = await vscode.workspace.openTextDocument(lupaUri);
	await applyDumpLanguage(document);
	await vscode.window.showTextDocument(document, { preview: false, ...showOptions });
	openedLupaFor.add(normalized.fsPath.toLowerCase());
}

export async function maybeAutoOpenRobloxFile(
	document: vscode.TextDocument,
	output: vscode.OutputChannel,
): Promise<void> {
	const config = vscode.workspace.getConfiguration('lupa');
	if (!config.get<boolean>('openByDefault', true)) {
		return;
	}

	if (document.uri.scheme !== 'file' || !isRobloxFile(document.uri)) {
		return;
	}

	if (isInDiffContext(document.uri)) {
		return;
	}

	const key = document.uri.fsPath.toLowerCase();
	if (openedLupaFor.has(key)) {
		return;
	}

	output.appendLine(`Auto-opening Roblox file as Lupa view: ${document.uri.fsPath}`);
	await openLupaDocument(document.uri, output);
}

export async function maybeAutoOpenRobloxUri(
	fileUri: vscode.Uri,
	output: vscode.OutputChannel,
): Promise<void> {
	if (fileUri.scheme !== 'file' || !isRobloxFile(fileUri)) {
		return;
	}

	if (isInDiffContext(fileUri)) {
		return;
	}

	const key = fileUri.fsPath.toLowerCase();
	if (openedLupaFor.has(key)) {
		return;
	}

	output.appendLine(`Auto-opening Roblox file as Lupa view: ${fileUri.fsPath}`);
	await openLupaDocument(fileUri, output);
}

export async function scanOpenRobloxFiles(output: vscode.OutputChannel): Promise<void> {
	for (const document of vscode.workspace.textDocuments) {
		await maybeAutoOpenRobloxFile(document, output);
	}

	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputText) {
				await maybeAutoOpenRobloxUri(tab.input.uri, output);
			}
		}
	}

	const active = vscode.window.activeTextEditor?.document;
	if (active) {
		await maybeAutoOpenRobloxFile(active, output);
	}
}
