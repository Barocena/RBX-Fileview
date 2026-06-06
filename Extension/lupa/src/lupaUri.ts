import * as vscode from 'vscode';

export const LUPA_SCHEME = 'lupa';
export const ROBOX_EXTENSIONS = new Set(['.rbxl', '.rbxlx', '.rbxm', '.rbxmx']);

export function isRobloxFile(uri: vscode.Uri): boolean {
	if (uri.scheme !== 'file') {
		return false;
	}

	const extension = uri.path.slice(uri.path.lastIndexOf('.')).toLowerCase();
	return ROBOX_EXTENSIONS.has(extension);
}

export function isLupaUri(uri: vscode.Uri): boolean {
	return uri.scheme === LUPA_SCHEME;
}

export function normalizeRobloxFileUri(uri: vscode.Uri): vscode.Uri {
	if (isLupaUri(uri)) {
		return fromLupaUri(uri).with({ query: '', fragment: '' });
	}

	return uri.with({ query: '', fragment: '' });
}

export function toLupaUri(fileUri: vscode.Uri): vscode.Uri {
	return normalizeRobloxFileUri(fileUri).with({ scheme: LUPA_SCHEME });
}

export function fromLupaUri(lupaUri: vscode.Uri): vscode.Uri {
	return lupaUri.with({ scheme: 'file' });
}

export function getLupaGitRef(uri: vscode.Uri): 'HEAD' | 'WORKTREE' {
	const ref = new URLSearchParams(uri.query).get('ref');
	return ref === 'HEAD' ? 'HEAD' : 'WORKTREE';
}
