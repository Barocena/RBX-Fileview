import * as path from 'node:path';
import * as vscode from 'vscode';
import { fromLupaUri, isLupaUri, isRobloxFile, normalizeRobloxFileUri } from './lupaUri';

export function robloxFileKey(fileUri: vscode.Uri): string {
	return normalizeRobloxFileUri(fileUri).fsPath.toLowerCase();
}

export function robloxFileUriFromGitUri(uri: vscode.Uri): vscode.Uri | undefined {
	const candidates: string[] = [];

	try {
		const decodedQuery = decodeURIComponent(uri.query);
		if (decodedQuery.startsWith('{')) {
			candidates.push(decodedQuery);
		}
	} catch {
		// Ignore decode failures.
	}

	if (uri.query.startsWith('{')) {
		candidates.push(uri.query);
	}

	for (const query of candidates) {
		try {
			const parsed = JSON.parse(query) as { path?: string; fsPath?: string };
			const rawPath = parsed.path ?? parsed.fsPath;
			if (!rawPath) {
				continue;
			}

			const candidate = vscode.Uri.file(rawPath);
			if (isRobloxFile(candidate)) {
				return normalizeRobloxFileUri(candidate);
			}
		} catch {
			// Try the next query format.
		}
	}

	let filePath = uri.path;
	try {
		filePath = decodeURIComponent(filePath);
	} catch {
		// Keep the raw path.
	}

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
		return normalizeRobloxFileUri(fromLupaUri(uri));
	}

	if (uri.scheme === 'file' && isRobloxFile(uri)) {
		return normalizeRobloxFileUri(uri);
	}

	if (uri.scheme === 'git') {
		return robloxFileUriFromGitUri(uri);
	}

	return undefined;
}
