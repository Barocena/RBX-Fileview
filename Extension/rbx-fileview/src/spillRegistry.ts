import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { DumpResult } from './fileviewCli';
import { isLargeDump } from './dumpLimits';
import { robloxFileKey } from './robloxUri';

const SPILL_DIR = path.join(os.tmpdir(), 'rbx-fileview');
const SPILL_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SPILL_CLEANUP_DELAY_MS = 5000;

interface SpillEntry {
	spillPath: string;
	cacheKey: string;
}

const sourceSpillEntries = new Map<string, SpillEntry>();
const spillToSourceKey = new Map<string, string>();
const pendingSpillCleanup = new Map<string, NodeJS.Timeout>();

export function isSpillDumpUri(uri: vscode.Uri): boolean {
	return uri.scheme === 'file' && uri.fsPath.startsWith(`${SPILL_DIR}${path.sep}`);
}

export function spillPathForSource(sourceUri: vscode.Uri): string | undefined {
	return sourceSpillEntries.get(robloxFileKey(sourceUri))?.spillPath;
}

export function findSourceUriForSpillPath(spillPath: string): vscode.Uri | undefined {
	const key = spillToSourceKey.get(spillPath);
	if (!key) {
		return undefined;
	}

	return vscode.Uri.file(key);
}

export function getFreshSpillEntry(sourceUri: vscode.Uri, cacheKey: string): SpillEntry | undefined {
	const entry = sourceSpillEntries.get(robloxFileKey(sourceUri));
	if (!entry || entry.cacheKey !== cacheKey) {
		return undefined;
	}

	return entry;
}

export function registerSpillForSource(sourceUri: vscode.Uri, spillPath: string, cacheKey: string): void {
	const key = robloxFileKey(sourceUri);
	const previous = sourceSpillEntries.get(key);
	if (previous && previous.spillPath !== spillPath) {
		spillToSourceKey.delete(previous.spillPath);
		void deleteSpillFile(previous.spillPath);
	}

	sourceSpillEntries.set(key, { spillPath, cacheKey });
	spillToSourceKey.set(spillPath, key);
}

function clearSpillRegistry(): void {
	sourceSpillEntries.clear();
	spillToSourceKey.clear();
}

export function unregisterSpillPath(spillPath: string): void {
	const key = spillToSourceKey.get(spillPath);
	if (key) {
		sourceSpillEntries.delete(key);
	}
	spillToSourceKey.delete(spillPath);
}

function spillSlug(filePath: string, suffix: string): string {
	const base = path.basename(filePath, path.extname(filePath));
	const hash = createHash('sha256').update(filePath).digest('hex').slice(0, 10);
	return `${base}-${hash}.${suffix}.yaml`;
}

export async function resolveSpillPath(filePath: string, suffix: string): Promise<string> {
	await fs.mkdir(SPILL_DIR, { recursive: true });
	return path.join(SPILL_DIR, spillSlug(filePath, suffix));
}

export async function ensureDumpUri(
	filePath: string,
	suffix: string,
	result: DumpResult,
): Promise<vscode.Uri> {
	if (result.spillPath) {
		return vscode.Uri.file(result.spillPath);
	}

	const byteLength = Buffer.byteLength(result.stdout, 'utf8');
	if (!isLargeDump(byteLength)) {
		throw new Error('ensureDumpUri called for a small in-memory dump');
	}

	const spillPath = await resolveSpillPath(filePath, suffix);
	await fs.writeFile(spillPath, result.stdout, 'utf8');
	return vscode.Uri.file(spillPath);
}

export function isSpillPathInUse(spillPath: string): boolean {
	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (!(tab.input instanceof vscode.TabInputText)) {
				continue;
			}

			if (tab.input.uri.fsPath === spillPath) {
				return true;
			}
		}
	}

	return false;
}

export async function deleteSpillFile(spillPath: string): Promise<void> {
	const pending = pendingSpillCleanup.get(spillPath);
	if (pending) {
		clearTimeout(pending);
		pendingSpillCleanup.delete(spillPath);
	}

	unregisterSpillPath(spillPath);
	await fs.rm(spillPath, { force: true }).catch(() => undefined);
}

export async function deleteSpillFileIfUnused(spillPath: string): Promise<void> {
	if (isSpillPathInUse(spillPath)) {
		return;
	}

	await deleteSpillFile(spillPath);
}

export function scheduleSpillCleanup(spillPath: string): void {
	const pending = pendingSpillCleanup.get(spillPath);
	if (pending) {
		clearTimeout(pending);
	}

	pendingSpillCleanup.set(
		spillPath,
		setTimeout(() => {
			pendingSpillCleanup.delete(spillPath);
			void deleteSpillFileIfUnused(spillPath);
		}, SPILL_CLEANUP_DELAY_MS),
	);
}

export async function invalidateSpillForSource(sourceUri: vscode.Uri): Promise<void> {
	const entry = sourceSpillEntries.get(robloxFileKey(sourceUri));
	if (!entry) {
		return;
	}

	sourceSpillEntries.delete(robloxFileKey(sourceUri));
	spillToSourceKey.delete(entry.spillPath);

	if (!isSpillPathInUse(entry.spillPath)) {
		await deleteSpillFile(entry.spillPath);
	}
}

export function findSpillTabForSource(sourceUri: vscode.Uri): vscode.Tab | undefined {
	const key = robloxFileKey(sourceUri);

	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (!(tab.input instanceof vscode.TabInputText)) {
				continue;
			}

			if (!isSpillDumpUri(tab.input.uri)) {
				continue;
			}

			const source = findSourceUriForSpillPath(tab.input.uri.fsPath);
			if (source && robloxFileKey(source) === key) {
				return tab;
			}
		}
	}

	return undefined;
}

export async function sweepOldSpillFiles(): Promise<number> {
	let removed = 0;

	try {
		const entries = await fs.readdir(SPILL_DIR, { withFileTypes: true });
		const now = Date.now();

		for (const entry of entries) {
			if (!entry.isFile() || !entry.name.endsWith('.yaml')) {
				continue;
			}

			const spillPath = path.join(SPILL_DIR, entry.name);
			if (isSpillPathInUse(spillPath) || spillToSourceKey.has(spillPath)) {
				continue;
			}

			const stat = await fs.stat(spillPath);
			if (now - stat.mtimeMs <= SPILL_MAX_AGE_MS) {
				continue;
			}

			await fs.rm(spillPath, { force: true });
			removed += 1;
		}
	} catch (error) {
		const errno = error as NodeJS.ErrnoException;
		if (errno.code !== 'ENOENT') {
			throw error;
		}
	}

	return removed;
}

export async function disposeSpillDirectory(): Promise<void> {
	for (const timeout of pendingSpillCleanup.values()) {
		clearTimeout(timeout);
	}
	pendingSpillCleanup.clear();
	clearSpillRegistry();
	await fs.rm(SPILL_DIR, { recursive: true, force: true }).catch(() => undefined);
}
