import * as vscode from 'vscode';

export const LUPA_SCHEME = 'lupa';
export const LUPA_VIRTUAL_SUFFIX = '.lupa.yaml';
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
	const normalized = normalizeRobloxFileUri(fileUri);
	const virtualPath = normalized.path.endsWith(LUPA_VIRTUAL_SUFFIX)
		? normalized.path
		: `${normalized.path}${LUPA_VIRTUAL_SUFFIX}`;

	return normalized.with({
		scheme: LUPA_SCHEME,
		path: virtualPath,
	});
}

export function fromLupaUri(lupaUri: vscode.Uri): vscode.Uri {
	let filePath = lupaUri.path;
	if (filePath.endsWith(LUPA_VIRTUAL_SUFFIX)) {
		filePath = filePath.slice(0, -LUPA_VIRTUAL_SUFFIX.length);
	}

	return lupaUri.with({ scheme: 'file', path: filePath });
}

export function getLupaGitRef(uri: vscode.Uri): 'HEAD' | 'WORKTREE' {
	const ref = new URLSearchParams(uri.query).get('ref');
	return ref === 'HEAD' ? 'HEAD' : 'WORKTREE';
}
