import * as vscode from 'vscode';
import type { LupaTextDocumentProvider } from './lupaTextDocumentProvider';
import { isLupaUri, normalizeRobloxFileUri, toLupaUri } from './lupaUri';
import { findLupaSingleTab, focusTab } from './robloxTabs';
import { robloxFileKey } from './robloxUri';

const openingDocuments = new Map<string, Promise<void>>();

export async function applyDumpLanguage(document: vscode.TextDocument): Promise<void> {
	if (!isLupaUri(document.uri)) {
		return;
	}

	if (document.languageId !== 'yaml') {
		await vscode.languages.setTextDocumentLanguage(document, 'yaml');
	}
}

export async function openLupaDocument(
	fileUri: vscode.Uri,
	output?: vscode.OutputChannel,
	showOptions?: vscode.TextDocumentShowOptions,
	textProvider?: LupaTextDocumentProvider,
): Promise<void> {
	const normalized = normalizeRobloxFileUri(fileUri);
	const key = robloxFileKey(normalized);

	const existing = findLupaSingleTab(normalized);
	if (existing) {
		output?.appendLine(`Focusing existing Lupa tab: ${normalized.fsPath}`);
		await focusTab(existing, textProvider);
		return;
	}

	const inFlight = openingDocuments.get(key);
	if (inFlight) {
		await inFlight;
		const opened = findLupaSingleTab(normalized);
		if (opened) {
			await focusTab(opened, textProvider);
		}
		return;
	}

	const openTask = (async () => {
		const lupaUri = toLupaUri(normalized);
		output?.appendLine(`Opening Lupa document: ${lupaUri.toString()}`);

		textProvider?.prepareOpen(normalized);

		const document = await vscode.workspace.openTextDocument(lupaUri);
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
