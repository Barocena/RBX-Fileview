import * as path from 'node:path';
import * as vscode from 'vscode';
import { isLupaUri, isRobloxFile, normalizeRobloxFileUri } from './lupaUri';

export function robloxFileKey(fileUri: vscode.Uri): string {
	return normalizeRobloxFileUri(fileUri).fsPath.toLowerCase();
}

export function robloxFileUriFromGitUri(uri: vscode.Uri): vscode.Uri | undefined {
	try {
		const query = decodeURIComponent(uri.query);
		if (query.startsWith('{')) {
			const parsed = JSON.parse(query) as { path?: string };
			if (parsed.path) {
				const candidate = vscode.Uri.file(parsed.path);
				if (isRobloxFile(candidate)) {
					return normalizeRobloxFileUri(candidate);
				}
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
	const candidate = vscode.Uri.file(filePath);
	if (isRobloxFile(candidate)) {
		return normalizeRobloxFileUri(candidate);
	}

	return undefined;
}

export function robloxFileUriFromTabUri(uri: vscode.Uri): vscode.Uri | undefined {
	if (isLupaUri(uri)) {
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
