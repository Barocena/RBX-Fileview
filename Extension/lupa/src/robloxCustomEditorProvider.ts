import * as path from 'node:path';
import * as vscode from 'vscode';
import { LupaTextDocumentProvider } from './lupaTextDocumentProvider';
import { isRobloxFile, normalizeRobloxFileUri, toLupaUri } from './lupaUri';

class RobloxCustomDocument implements vscode.CustomDocument {
	constructor(readonly uri: vscode.Uri, readonly fileUri: vscode.Uri) {}

	dispose(): void {
		// Read-only custom document with no external resources.
	}
}

function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function buildReadonlyHtml(title: string, content: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${escapeHtml(title)}</title>
	<style>
		body {
			margin: 0;
			padding: 16px;
			font-family: var(--vscode-editor-font-family, monospace);
			font-size: var(--vscode-editor-font-size, 13px);
			color: var(--vscode-editor-foreground);
			background: var(--vscode-editor-background);
		}
		pre {
			margin: 0;
			white-space: pre-wrap;
			word-break: break-word;
		}
	</style>
</head>
<body><pre>${escapeHtml(content)}</pre></body>
</html>`;
}

function buildErrorHtml(message: string): string {
	return buildReadonlyHtml('Lupa', `Failed to load Lupa dump:\n\n${message}`);
}

export class RobloxCustomEditorProvider implements vscode.CustomReadonlyEditorProvider<RobloxCustomDocument> {
	constructor(
		private readonly textProvider: LupaTextDocumentProvider,
		private readonly output: vscode.OutputChannel,
	) {}

	async openCustomDocument(
		uri: vscode.Uri,
		_openContext: vscode.CustomDocumentOpenContext,
		_token: vscode.CancellationToken,
	): Promise<RobloxCustomDocument> {
		if (!isRobloxFile(uri)) {
			throw new Error(`Unsupported file for Lupa custom editor: ${uri.toString()}`);
		}

		return new RobloxCustomDocument(uri, normalizeRobloxFileUri(uri));
	}

	async resolveCustomEditor(
		document: RobloxCustomDocument,
		webviewPanel: vscode.WebviewPanel,
		token: vscode.CancellationToken,
	): Promise<void> {
		const title = path.basename(document.fileUri.fsPath);
		webviewPanel.webview.html = buildReadonlyHtml(title, 'Loading Lupa dump...');

		try {
			const lupaUri = toLupaUri(document.fileUri);
			this.output.appendLine(`Rendering Lupa custom editor: ${lupaUri.toString()}`);
			const content = await this.textProvider.provideTextDocumentContent(lupaUri, token);
			webviewPanel.webview.html = buildReadonlyHtml(title, content);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.output.appendLine(`Custom editor render failed: ${message}`);
			webviewPanel.webview.html = buildErrorHtml(message);
		}
	}
}
