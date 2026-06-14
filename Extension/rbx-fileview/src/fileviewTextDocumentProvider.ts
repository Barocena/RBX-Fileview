import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { buildDumpCacheKey } from './dumpCacheKey';
import { dumpNeedsSpill } from './dumpLimits';
import { errorMessage } from './errorMessage';
import { dumpRobloxFileAtRef } from './gitRefDump';
import type { GitRef } from './gitRefDump';
import type { DumpResult } from './fileviewCli';
import {
	fromFileviewUri,
	getFileviewGitRef,
	isFileviewUri,
	isRobloxFile,
	FILEVIEW_SCHEME,
	toFileviewUri,
} from './fileviewUri';
import {
	findSourceUriForSpillPath,
	getFreshSpillEntry,
	invalidateSpillForSource,
	registerSpillForSource,
	spillPathForSource,
} from './spillRegistry';

type WarmDumpResult = {
	content: string;
	spillPath?: string;
	byteLength: number;
};

export class FileviewTextDocumentProvider implements vscode.TextDocumentContentProvider {
	private readonly changeEmitter = new vscode.EventEmitter<vscode.Uri>();
	readonly onDidChange = this.changeEmitter.event;

	private readonly watchers = new Map<string, vscode.FileSystemWatcher>();
	private readonly contentCache = new Map<string, string>();
	private output: vscode.OutputChannel | undefined;

	setOutputChannel(output: vscode.OutputChannel): void {
		this.output = output;
	}

	private async resolveMtime(filePath: string, ref: GitRef): Promise<number | undefined> {
		if (ref !== 'WORKTREE') {
			return undefined;
		}

		try {
			const stat = await fs.stat(filePath);
			return stat.mtimeMs;
		} catch {
			return undefined;
		}
	}

	private invalidateCacheForFile(filePath: string): void {
		for (const key of this.contentCache.keys()) {
			if (key.startsWith(`${filePath}\0`)) {
				this.contentCache.delete(key);
			}
		}
	}

	private async buildCacheKey(sourceUri: vscode.Uri, ref: GitRef): Promise<string> {
		const mtimeMs = await this.resolveMtime(sourceUri.fsPath, ref);
		return buildDumpCacheKey(sourceUri.fsPath, ref, mtimeMs);
	}

	private fireRefreshForOpenDocuments(sourceUri: vscode.Uri): void {
		const key = sourceUri.fsPath;
		this.invalidateCacheForFile(key);

		for (const document of vscode.workspace.textDocuments) {
			if (document.uri.scheme !== FILEVIEW_SCHEME) {
				continue;
			}

			if (fromFileviewUri(document.uri).fsPath === key) {
				this.changeEmitter.fire(document.uri);
			}
		}

		this.changeEmitter.fire(toFileviewUri(sourceUri));
	}

	private storeDumpResult(
		cacheKey: string,
		sourceUri: vscode.Uri,
		ref: GitRef,
		result: DumpResult,
	): WarmDumpResult {
		if (result.spillPath) {
			if (ref === 'WORKTREE') {
				registerSpillForSource(sourceUri, result.spillPath, cacheKey);
			}

			this.output?.appendLine(`Dump ok: ${sourceUri.fsPath} (${result.byteLength} bytes, spilled)`);
			return {
				content: '',
				spillPath: result.spillPath,
				byteLength: result.byteLength,
			};
		}

		this.contentCache.set(cacheKey, result.stdout);
		this.output?.appendLine(`Dump ok: ${sourceUri.fsPath} (${result.byteLength} bytes)`);
		return {
			content: result.stdout,
			byteLength: result.byteLength,
		};
	}

	async warmCache(sourceUri: vscode.Uri, ref: GitRef = 'WORKTREE'): Promise<WarmDumpResult> {
		const filePath = sourceUri.fsPath;
		const cacheKey = await this.buildCacheKey(sourceUri, ref);

		const cached = this.contentCache.get(cacheKey);
		if (cached !== undefined) {
			return {
				content: cached,
				byteLength: Buffer.byteLength(cached, 'utf8'),
			};
		}

		if (ref === 'WORKTREE') {
			const spillEntry = getFreshSpillEntry(sourceUri, cacheKey);
			if (spillEntry) {
				try {
					const stat = await fs.stat(spillEntry.spillPath);
					this.output?.appendLine(`Spill cache hit: ${spillEntry.spillPath} (${stat.size} bytes)`);
					return {
						content: '',
						spillPath: spillEntry.spillPath,
						byteLength: stat.size,
					};
				} catch {
					await invalidateSpillForSource(sourceUri);
				}
			} else if (spillPathForSource(sourceUri)) {
				await invalidateSpillForSource(sourceUri);
			}
		}

		this.output?.appendLine(`Warming dump cache: ${filePath} (ref=${ref})`);
		const result = await dumpRobloxFileAtRef(filePath, ref);
		return this.storeDumpResult(cacheKey, sourceUri, ref, result);
	}

	async provideTextDocumentContent(
		uri: vscode.Uri,
		_token: vscode.CancellationToken,
	): Promise<string> {
		const sourceUri = fromFileviewUri(uri);
		const ref = getFileviewGitRef(uri);
		const filePath = sourceUri.fsPath;
		const cacheKey = await this.buildCacheKey(sourceUri, ref);

		const cached = this.contentCache.get(cacheKey);
		if (cached !== undefined) {
			this.output?.appendLine(`Dump cache hit: ${filePath} (${cached.length} chars)`);
			return cached;
		}

		try {
			if (ref === 'WORKTREE') {
				this.ensureWatcher(sourceUri);
			}

			const result = await dumpRobloxFileAtRef(filePath, ref);
			if (dumpNeedsSpill(result)) {
				throw new Error(
					`Dump is ${result.byteLength} bytes and exceeds VS Code's 50MB extension document limit. ` +
						'Use "RBX-Fileview: Open with RBX-Fileview" to open the on-disk YAML view.',
				);
			}

			this.contentCache.set(cacheKey, result.stdout);
			return result.stdout;
		} catch (error) {
			this.output?.appendLine(`Dump failed: ${errorMessage(error)}`);
			throw error;
		}
	}

	private invalidateAll(): void {
		this.contentCache.clear();
	}

	refresh(uri?: vscode.Uri): void {
		if (uri) {
			if (isFileviewUri(uri)) {
				this.invalidateCacheForFile(fromFileviewUri(uri).fsPath);
				this.changeEmitter.fire(uri);
				return;
			}

			const spillSource = findSourceUriForSpillPath(uri.fsPath);
			if (spillSource) {
				void this.refreshSpillDocument(spillSource);
				return;
			}

			if (isRobloxFile(uri)) {
				this.fireRefreshForSourceFile(uri);
			}
			return;
		}

		this.contentCache.clear();
		for (const document of vscode.workspace.textDocuments) {
			if (document.uri.scheme === FILEVIEW_SCHEME) {
				this.changeEmitter.fire(document.uri);
			}
		}
	}

	private async refreshSpillDocument(sourceUri: vscode.Uri): Promise<void> {
		this.invalidateCacheForFile(sourceUri.fsPath);
		await invalidateSpillForSource(sourceUri);
		const warmed = await this.warmCache(sourceUri, 'WORKTREE');
		if (!warmed.spillPath) {
			return;
		}

		const openDocument = vscode.workspace.textDocuments.find(
			(document) => document.uri.fsPath === warmed.spillPath,
		);
		if (!openDocument) {
			return;
		}

		await vscode.commands.executeCommand('workbench.action.files.revert', openDocument.uri);
	}

	async invalidateSettings(): Promise<void> {
		this.invalidateAll();

		const spillSources = new Set<vscode.Uri>();
		for (const document of vscode.workspace.textDocuments) {
			if (isFileviewUri(document.uri)) {
				this.changeEmitter.fire(document.uri);
				continue;
			}

			const source = findSourceUriForSpillPath(document.uri.fsPath);
			if (source) {
				spillSources.add(source);
			}
		}

		for (const source of spillSources) {
			await this.refreshSpillDocument(source);
		}
	}

	/** Re-dump before opening or refocusing a tab. VS Code caches virtual documents. */
	prepareOpen(sourceUri: vscode.Uri): void {
		if (getFileviewGitRef(toFileviewUri(sourceUri)) === 'WORKTREE') {
			this.ensureWatcher(sourceUri);
		}
		this.fireRefreshForOpenDocuments(sourceUri);
	}

	private fireRefreshForSourceFile(sourceUri: vscode.Uri): void {
		this.fireRefreshForOpenDocuments(sourceUri);
		void this.refreshSpillDocument(sourceUri);
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
			this.invalidateCacheForFile(key);
			void invalidateSpillForSource(sourceUri);
		});

		this.watchers.set(key, watcher);
	}

	dispose(): void {
		for (const watcher of this.watchers.values()) {
			watcher.dispose();
		}
		this.watchers.clear();
		this.contentCache.clear();
		this.changeEmitter.dispose();
	}
}
