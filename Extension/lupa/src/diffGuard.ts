import * as vscode from 'vscode';
import { fromLupaUri, isLupaUri } from './lupaUri';

let diffOperationDepth = 0;

export function beginDiffOperation(): void {
	diffOperationDepth += 1;
}

export function endDiffOperation(): void {
	setTimeout(() => {
		diffOperationDepth = Math.max(0, diffOperationDepth - 1);
	}, 3000);
}

function pathsEqual(left: vscode.Uri, right: vscode.Uri): boolean {
	return left.fsPath.toLowerCase() === right.fsPath.toLowerCase();
}

function uriPathVariants(uri: vscode.Uri): vscode.Uri[] {
	if (isLupaUri(uri)) {
		return [uri, fromLupaUri(uri)];
	}

	return [uri];
}

export function isInDiffContext(fileUri?: vscode.Uri): boolean {
	if (diffOperationDepth > 0) {
		return true;
	}

	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (!(tab.input instanceof vscode.TabInputTextDiff)) {
				continue;
			}

			if (!fileUri) {
				return true;
			}

			const { original, modified } = tab.input;

			for (const side of [original, modified]) {
				for (const candidate of uriPathVariants(side)) {
					if (pathsEqual(candidate, fileUri)) {
						return true;
					}
				}
			}
		}
	}

	return false;
}
