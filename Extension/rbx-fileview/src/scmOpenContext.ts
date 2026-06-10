import * as vscode from 'vscode';
import { fromFileviewUri, isFileviewUri, normalizeRobloxFileUri } from './fileviewUri';
import { robloxFileKey } from './robloxUri';

const SCM_ORIGIN_TTL_MS = 5000;
const scmOriginatedKeys = new Set<string>();

export function markScmOriginatedOpen(fileUri: vscode.Uri): void {
	const key = robloxFileKey(normalizeRobloxFileUri(fileUri));
	scmOriginatedKeys.add(key);

	setTimeout(() => {
		scmOriginatedKeys.delete(key);
	}, SCM_ORIGIN_TTL_MS);
}

export function wasScmOriginatedOpen(uri: vscode.Uri): boolean {
	const source = isFileviewUri(uri) ? fromFileviewUri(uri) : uri;
	return scmOriginatedKeys.has(robloxFileKey(normalizeRobloxFileUri(source)));
}
