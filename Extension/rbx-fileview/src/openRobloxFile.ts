import * as vscode from 'vscode';
import type { FileviewTextDocumentProvider } from './fileviewTextDocumentProvider';
import { isFileviewUri, normalizeRobloxFileUri, toFileviewUri } from './fileviewUri';
import { findFileviewSingleTab, focusTab } from './robloxTabs';
import { robloxFileKey } from './robloxUri';

const openingDocuments = new Map<string, Promise<void>>();

export async function applyDumpLanguage(document: vscode.TextDocument): Promise<void> {
	if (!isFileviewUri(document.uri)) {
		return;
	}

	if (document.languageId !== 'yaml') {
		await vscode.languages.setTextDocumentLanguage(document, 'yaml');
	}
}

export async function openFileviewDocument(
	fileUri: vscode.Uri,
	output?: vscode.OutputChannel,
	showOptions?: vscode.TextDocumentShowOptions,
	textProvider?: FileviewTextDocumentProvider,
): Promise<void> {
	const normalized = normalizeRobloxFileUri(fileUri);
	const key = robloxFileKey(normalized);

	const existing = findFileviewSingleTab(normalized);
	if (existing) {
		output?.appendLine(`Focusing existing RBX-Fileview tab: ${normalized.fsPath}`);
		await focusTab(existing, textProvider);
		return;
	}

	const inFlight = openingDocuments.get(key);
	if (inFlight) {
		await inFlight;
		const opened = findFileviewSingleTab(normalized);
		if (opened) {
			await focusTab(opened, textProvider);
		}
		return;
	}

	const openTask = (async () => {
		const fileviewUri = toFileviewUri(normalized);
		output?.appendLine(`Opening RBX-Fileview document: ${fileviewUri.toString()}`);

		textProvider?.prepareOpen(normalized);

		const document = await vscode.workspace.openTextDocument(fileviewUri);
		await applyDumpLanguage(document);
		await vscode.window.showTextDocument(document, { preview: false, ...showOptions });
	})();

	openingDocuments.set(key, openTask);
	try {
		await openTask;
	} finally {
		openingDocuments.delete(key);
	}
}
