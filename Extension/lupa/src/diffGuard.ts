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
			const candidates = [original, modified, isLupaUri(original) ? fromLupaUri(original) : original];

			for (const candidate of candidates) {
				if (pathsEqual(candidate, fileUri)) {
					return true;
				}
			}

			if (isLupaUri(modified) && pathsEqual(fromLupaUri(modified), fileUri)) {
				return true;
			}
		}
	}

	return false;
}
