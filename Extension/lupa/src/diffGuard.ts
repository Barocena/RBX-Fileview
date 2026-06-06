import * as vscode from 'vscode';
import { fromLupaUri, isLupaUri, isRobloxFile } from './lupaUri';

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

export function isRobloxDiffTabOpen(): boolean {
	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (tab.input instanceof vscode.TabInputTextDiff) {
				const { original, modified } = tab.input;
				if (isLupaUri(original) || isLupaUri(modified)) {
					return true;
				}
				if (isRobloxFile(original) || isRobloxFile(modified)) {
					return true;
				}
			}
		}
	}
	return false;
}

export function isLupaDiffOpenForFile(fileUri: vscode.Uri): boolean {
	if (diffOperationDepth > 0) {
		return true;
	}

	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (!(tab.input instanceof vscode.TabInputTextDiff)) {
				continue;
			}

			const { original, modified } = tab.input;
			if (!isLupaUri(original) && !isLupaUri(modified)) {
				continue;
			}

			const sides = [original, modified];
			for (const side of sides) {
				const candidate = isLupaUri(side) ? fromLupaUri(side) : side;
				if (pathsEqual(candidate, fileUri)) {
					return true;
				}
			}
		}
	}

	return false;
}
