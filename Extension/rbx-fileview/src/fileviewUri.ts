import * as path from 'node:path';
import * as vscode from 'vscode';
import type { GitRef } from './gitRefDump';

export const FILEVIEW_SCHEME = 'rbx-fileview';
export const FILEVIEW_CUSTOM_EDITOR_VIEW_TYPE = 'rbx-fileview.roblox';

export const ROBLOX_EXTENSIONS = new Set(['.rbxl', '.rbxlx', '.rbxm', '.rbxmx']);

export const ROBLOX_GLOB_PATTERNS = ['*.rbxl', '*.rbxlx', '*.rbxm', '*.rbxmx'] as const;

export function isRobloxFile(uri: vscode.Uri): boolean {
	if (uri.scheme !== 'file') {
		return false;
	}

	return ROBLOX_EXTENSIONS.has(path.extname(uri.fsPath).toLowerCase());
}

export function isFileviewUri(uri: vscode.Uri): boolean {
	return uri.scheme === FILEVIEW_SCHEME;
}

export function normalizeRobloxFileUri(uri: vscode.Uri): vscode.Uri {
	if (isFileviewUri(uri)) {
		return fromFileviewUri(uri);
	}

	return uri.with({ query: '', fragment: '' });
}

export function toFileviewUri(fileUri: vscode.Uri): vscode.Uri {
	return normalizeRobloxFileUri(fileUri).with({ scheme: FILEVIEW_SCHEME });
}

export function fromFileviewUri(fileviewUri: vscode.Uri): vscode.Uri {
	return fileviewUri.with({ scheme: 'file', authority: '', query: '', fragment: '' });
}

export function formatRefForDisplay(ref: GitRef): string {
	if (ref === 'WORKTREE') {
		return '';
	}

	if (ref === 'HEAD' || ref === 'INDEX') {
		return ref;
	}

	return ref.length > 8 ? `${ref.slice(0, 8)}…` : ref;
}

function parseFileviewQuery(uri: vscode.Uri): { ref?: string } {
	const query = decodeURIComponent(uri.query);
	if (!query) {
		return {};
	}

	if (query.startsWith('{')) {
		try {
			return JSON.parse(query) as { ref?: string };
		} catch {
			return {};
		}
	}

	const ref = new URLSearchParams(query).get('ref');
	return ref ? { ref } : {};
}

export function getFileviewGitRef(uri: vscode.Uri): GitRef {
	const ref = parseFileviewQuery(uri).ref;
	if (!ref || ref === 'WORKTREE') {
		return 'WORKTREE';
	}

	return ref;
}

export function isFileviewGitRevision(uri: vscode.Uri): boolean {
	return isFileviewUri(uri) && getFileviewGitRef(uri) !== 'WORKTREE';
}

export function toFileviewGitUri(fileUri: vscode.Uri, ref: GitRef): vscode.Uri {
	const base = toFileviewUri(fileUri);
	if (ref === 'WORKTREE') {
		return base;
	}

	const displayRef = formatRefForDisplay(ref);
	const basename = path.basename(normalizeRobloxFileUri(fileUri).fsPath);
	return base.with({
		authority: displayRef,
		query: JSON.stringify({ ref, basename }),
	});
}
