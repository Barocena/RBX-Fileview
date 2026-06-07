import * as vscode from 'vscode';
import { isLupaUri, normalizeRobloxFileUri, toLupaUri } from './lupaUri';

export async function applyDumpLanguage(document: vscode.TextDocument): Promise<void> {
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
}
