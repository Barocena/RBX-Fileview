import * as path from 'node:path';
import * as vscode from 'vscode';
import { dumpRobloxFileAtRef } from './gitRefDump';
import { fromLupaUri, getLupaGitRef, isLupaUri, isRobloxFile, LUPA_SCHEME, toLupaUri } from './lupaUri';

export class LupaTextDocumentProvider implements vscode.TextDocumentContentProvider {
	private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();
	readonly onDidChange = this.changeEmitter.event;

	private readonly watchers = new Map<string, vscode.FileSystemWatcher>();
	private output: vscode.OutputChannel | undefined;

	setOutputChannel(output: vscode.OutputChannel): void {
		this.output = output;
	}

	async provideTextDocumentContent(
		uri: vscode.Uri,
		_token: vscode.CancellationToken,
	): Promise<string> {
		const sourceUri = fromLupaUri(uri);
		const ref = getLupaGitRef(uri);

		this.output?.appendLine(`provideTextDocumentContent: ${uri.toString()} (ref=${ref})`);

		try {
			if (ref === 'WORKTREE') {
				this.ensureWatcher(sourceUri);
			}

			const result = await dumpRobloxFileAtRef(sourceUri.fsPath, ref);
			this.output?.appendLine(`Dump ok: ${sourceUri.fsPath} (${result.stdout.length} chars)`);
			return result.stdout;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.output?.appendLine(`Dump failed: ${message}`);
			throw error;
		}
	}

	refresh(uri?: vscode.Uri): void {
		if (uri) {
			const lupaUri = isLupaUri(uri) ? uri : isRobloxFile(uri) ? toLupaUri(uri) : undefined;
			if (lupaUri) {
				this.changeEmitter.fire(lupaUri);
			}
			return;
		}

		for (const document of vscode.workspace.textDocuments) {
			if (document.uri.scheme === LUPA_SCHEME) {
				this.changeEmitter.fire(document.uri);
			}
		}
	}

	private ensureWatcher(sourceUri: vscode.Uri): void {
		const key = sourceUri.fsPath;
		if (this.watchers.has(key)) {
			return;
		}

		const watchPattern = new vscode.RelativePattern(
			vscode.Uri.file(path.dirname(sourceUri.fsPath)),
			path.basename(sourceUri.fsPath),
		);
		const watcher = vscode.workspace.createFileSystemWatcher(watchPattern);
		const refreshUri = toLupaUri(sourceUri).with({ query: 'ref=WORKTREE' });

		watcher.onDidChange(() => {
			this.changeEmitter.fire(refreshUri);
		});
		watcher.onDidCreate(() => {
			this.changeEmitter.fire(refreshUri);
		});

		this.watchers.set(key, watcher);
	}

	dispose(): void {
		for (const watcher of this.watchers.values()) {
			watcher.dispose();
		}
		this.watchers.clear();
		this.changeEmitter.dispose();
	}
}
