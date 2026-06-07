import * as path from 'node:path';
import * as vscode from 'vscode';
import { errorMessage } from './errorMessage';
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
			this.output?.appendLine(`Dump failed: ${errorMessage(error)}`);
			throw error;
		}
	}

	refresh(uri?: vscode.Uri): void {
		if (uri) {
			if (isLupaUri(uri)) {
				this.changeEmitter.fire(uri);
				return;
			}

			if (isRobloxFile(uri)) {
				this.fireRefreshForSourceFile(uri);
			}
			return;
		}

		for (const document of vscode.workspace.textDocuments) {
			if (document.uri.scheme === LUPA_SCHEME) {
				this.changeEmitter.fire(document.uri);
			}
		}
	}

	/** Re-dump before opening or refocusing a tab. VS Code caches virtual documents. */
	prepareOpen(sourceUri: vscode.Uri): void {
		if (getLupaGitRef(toLupaUri(sourceUri)) === 'WORKTREE') {
			this.ensureWatcher(sourceUri);
		}
		this.fireRefreshForSourceFile(sourceUri);
	}

	private fireRefreshForSourceFile(sourceUri: vscode.Uri): void {
		const key = sourceUri.fsPath;
		for (const document of vscode.workspace.textDocuments) {
			if (document.uri.scheme !== LUPA_SCHEME) {
				continue;
			}

			if (fromLupaUri(document.uri).fsPath === key) {
				this.changeEmitter.fire(document.uri);
			}
		}

		// Explorer tabs use lupa: URIs without a query; fire that canonical URI too.
		this.changeEmitter.fire(toLupaUri(sourceUri));
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
		const refresh = () => {
			this.fireRefreshForSourceFile(sourceUri);
		};

		watcher.onDidChange(refresh);
		watcher.onDidCreate(refresh);
		watcher.onDidDelete(() => {
			watcher.dispose();
			this.watchers.delete(key);
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
