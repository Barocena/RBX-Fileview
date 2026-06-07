import * as vscode from 'vscode';
import type { LupaTextDocumentProvider } from './lupaTextDocumentProvider';
import { normalizeRobloxFileUri } from './lupaUri';
import { openLupaDocument } from './openRobloxFile';

class RobloxCustomDocument implements vscode.CustomDocument {
	constructor(readonly uri: vscode.Uri) {}

	dispose(): void {}
}

export class RobloxCustomEditorProvider implements vscode.CustomReadonlyEditorProvider<RobloxCustomDocument> {
	constructor(
		private readonly output: vscode.OutputChannel,
		private readonly textProvider?: LupaTextDocumentProvider,
	) {}

	async openCustomDocument(
		uri: vscode.Uri,
		_openContext: vscode.CustomDocumentOpenContext,
		_token: vscode.CancellationToken,
	): Promise<RobloxCustomDocument> {
		if (uri.scheme !== 'file') {
			throw new Error(
				`Lupa only supports file:// Roblox files here (got ${uri.scheme}:). ` +
					'Use "Lupa: Open Git Changes" for SCM diffs.',
			);
		}

		return new RobloxCustomDocument(normalizeRobloxFileUri(uri));
	}

	async resolveCustomEditor(
		document: RobloxCustomDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		this.output.appendLine(`Custom editor redirecting to Lupa text view: ${document.uri.fsPath}`);
		await openLupaDocument(document.uri, this.output, undefined, this.textProvider);
		setTimeout(() => {
			webviewPanel.dispose();
		}, 0);
	}
}
