import * as path from 'node:path';
import * as vscode from 'vscode';
import { errorMessage } from './errorMessage';
import type { FileviewTextDocumentProvider } from './fileviewTextDocumentProvider';
import { isFileviewUri, normalizeRobloxFileUri, toFileviewUri } from './fileviewUri';
import { findFileviewSingleTab, focusTab } from './robloxTabs';
import { robloxFileKey } from './robloxUri';
import { withOptionalDumpProgress } from './dumpCacheKey';
import { isSpillDumpUri } from './spillRegistry';

const openingDocuments = new Map<string, Promise<void>>();

/** Opens files too large for workspace.openTextDocument via the native workbench path. */
export async function openLargeFileInEditor(
	uri: vscode.Uri,
	showOptions?: vscode.TextDocumentShowOptions,
): Promise<void> {
	await vscode.commands.executeCommand('vscode.open', uri, {
		preview: false,
		...showOptions,
	});
}

async function applyYamlLanguage(document: vscode.TextDocument): Promise<void> {
	if (document.languageId !== 'yaml') {
		await vscode.languages.setTextDocumentLanguage(document, 'yaml');
	}
}

export async function applyDumpLanguage(document: vscode.TextDocument): Promise<void> {
	if (!isFileviewUri(document.uri) && !isSpillDumpUri(document.uri)) {
		return;
	}

	await applyYamlLanguage(document);
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
		output?.appendLine(`Opening RBX-Fileview document: ${normalized.fsPath}`);

		textProvider?.prepareOpen(normalized);

		try {
			const warmed = await withOptionalDumpProgress(
				`RBX-Fileview: dumping ${path.basename(normalized.fsPath)}`,
				[normalized],
				async () => textProvider?.warmCache(normalized, 'WORKTREE'),
			);

			if (warmed?.spillPath) {
				output?.appendLine(`Opening spilled dump: ${warmed.spillPath} (${warmed.byteLength} bytes)`);
				await openLargeFileInEditor(vscode.Uri.file(warmed.spillPath), showOptions);
				return;
			}

			const fileviewUri = toFileviewUri(normalized);
			const document = await vscode.workspace.openTextDocument(fileviewUri);
			await applyYamlLanguage(document);
			await vscode.window.showTextDocument(document, { preview: false, ...showOptions });
		} catch (error) {
			const message = errorMessage(error);
			output?.appendLine(`Open failed: ${message}`);
			void vscode.window.showErrorMessage(`RBX-Fileview failed to open ${path.basename(normalized.fsPath)}: ${message}`);
			throw error;
		}
	})();

	openingDocuments.set(key, openTask);
	try {
		await openTask;
	} finally {
		openingDocuments.delete(key);
	}
}
