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
		return fromFileviewUri(uri).with({ query: '', fragment: '' });
	}

	return uri.with({ query: '', fragment: '' });
}

export function toFileviewUri(fileUri: vscode.Uri): vscode.Uri {
	return normalizeRobloxFileUri(fileUri).with({ scheme: FILEVIEW_SCHEME });
}

export function fromFileviewUri(fileviewUri: vscode.Uri): vscode.Uri {
	return fileviewUri.with({ scheme: 'file' });
}

export function getFileviewGitRef(uri: vscode.Uri): GitRef {
	const ref = new URLSearchParams(uri.query).get('ref');
	if (!ref || ref === 'WORKTREE') {
		return 'WORKTREE';
	}

	return ref;
}

export function toFileviewGitUri(fileUri: vscode.Uri, ref: GitRef): vscode.Uri {
	const params = new URLSearchParams();
	params.set('ref', ref);
	return toFileviewUri(fileUri).with({ query: params.toString() });
}
