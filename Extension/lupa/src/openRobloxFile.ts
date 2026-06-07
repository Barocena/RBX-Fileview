import * as vscode from 'vscode';
import type { LupaTextDocumentProvider } from './lupaTextDocumentProvider';
import { isLupaUri, normalizeRobloxFileUri, toLupaUri } from './lupaUri';

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
	const lupaUri = toLupaUri(normalized);
	output?.appendLine(`Opening Lupa document: ${lupaUri.toString()}`);

	textProvider?.prepareOpen(normalized);

	const document = await vscode.workspace.openTextDocument(lupaUri);
	await applyDumpLanguage(document);
	await vscode.window.showTextDocument(document, { preview: false, ...showOptions });
}
