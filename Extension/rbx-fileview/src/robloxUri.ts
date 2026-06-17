import * as path from 'node:path';
import * as vscode from 'vscode';
import type { GitRef } from './gitRefDump';
import { getFileviewGitRef, isFileviewUri, isRobloxFile, normalizeRobloxFileUri } from './fileviewUri';

type ParsedGitUri = {
	path: string;
	ref?: string;
};

export function robloxFileKey(fileUri: vscode.Uri): string {
	return normalizeRobloxFileUri(fileUri).fsPath.toLowerCase();
}

export function normalizeGitRef(ref: string | undefined): GitRef {
	if (ref === undefined || ref === '') {
		return 'WORKTREE';
	}

	if (ref === 'HEAD') {
		return 'HEAD';
	}

	if (ref === '~') {
		return 'INDEX';
	}

	return ref;
}

export function parseGitUri(uri: vscode.Uri): ParsedGitUri | undefined {
	try {
		const query = decodeURIComponent(uri.query);
		if (query.startsWith('{')) {
			const parsed = JSON.parse(query) as { path?: string; ref?: string };
			if (parsed.path) {
				return {
					path: parsed.path,
					ref: parsed.ref,
				};
			}
		}
	} catch {
		// Fall through to path-based parsing.
	}

	let filePath = decodeURIComponent(uri.path);
	if (filePath.startsWith('/')) {
		filePath = filePath.slice(1);
	}

	filePath = filePath.replace(/\//g, path.sep);
	if (filePath.length === 0) {
		return undefined;
	}

	return { path: filePath };
}

export function robloxFileUriFromGitUri(uri: vscode.Uri): vscode.Uri | undefined {
	const parsed = parseGitUri(uri);
	if (!parsed) {
		return undefined;
	}

	const candidate = vscode.Uri.file(parsed.path);
	if (isRobloxFile(candidate)) {
		return normalizeRobloxFileUri(candidate);
	}

	return undefined;
}

export function gitRefFromGitUri(uri: vscode.Uri): GitRef | undefined {
	if (uri.scheme !== 'git') {
		return undefined;
	}

	const parsed = parseGitUri(uri);
	if (!parsed) {
		return undefined;
	}

	return normalizeGitRef(parsed.ref);
}

export function gitRefFromTabUri(uri: vscode.Uri): GitRef {
	if (isFileviewUri(uri)) {
		return getFileviewGitRef(uri);
	}

	if (uri.scheme === 'file') {
		return 'WORKTREE';
	}

	if (uri.scheme === 'git') {
		return gitRefFromGitUri(uri) ?? 'WORKTREE';
	}

	return 'WORKTREE';
}

export function robloxFileUriFromTabUri(uri: vscode.Uri): vscode.Uri | undefined {
	if (isFileviewUri(uri)) {
		return undefined;
	}

	if (uri.scheme === 'file' && isRobloxFile(uri)) {
		return normalizeRobloxFileUri(uri);
	}

	if (uri.scheme === 'git') {
		return robloxFileUriFromGitUri(uri);
	}

	return undefined;
}
