import * as vscode from 'vscode';
import { robloxFileKey, robloxFileUriFromTabUri } from './robloxUri';
import { isLupaUri } from './lupaUri';

const LUPA_CUSTOM_VIEW = 'lupa.roblox';

function isPlaceholderSingleTab(tab: vscode.Tab, key: string): boolean {
	if (!(tab.input instanceof vscode.TabInputText)) {
		return false;
	}

	if (isLupaUri(tab.input.uri)) {
		return false;
	}

	const fileUri = robloxFileUriFromTabUri(tab.input.uri);
	return fileUri !== undefined && robloxFileKey(fileUri) === key;
}

function isPlaceholderDiffTab(tab: vscode.Tab, key: string): boolean {
	if (!(tab.input instanceof vscode.TabInputTextDiff)) {
		return false;
	}

	if (isLupaUri(tab.input.original) || isLupaUri(tab.input.modified)) {
		return false;
	}

	const originalFile = robloxFileUriFromTabUri(tab.input.original);
	const modifiedFile = robloxFileUriFromTabUri(tab.input.modified);
	return (
		(originalFile !== undefined && robloxFileKey(originalFile) === key) ||
		(modifiedFile !== undefined && robloxFileKey(modifiedFile) === key)
	);
}

function isPlaceholderCustomTab(tab: vscode.Tab, key: string): boolean {
	if (!(tab.input instanceof vscode.TabInputCustom)) {
		return false;
	}

	if (tab.input.viewType !== LUPA_CUSTOM_VIEW) {
		return false;
	}

	return robloxFileKey(tab.input.uri) === key;
}

function collectPlaceholderTabs(
	fileUri: vscode.Uri,
	options?: {
		single?: boolean;
		diff?: boolean;
		custom?: boolean;
	},
): vscode.Tab[] {
	const key = robloxFileKey(fileUri);
	const includeSingle = options?.single ?? true;
	const includeDiff = options?.diff ?? false;
	const includeCustom = options?.custom ?? true;
	const toClose: vscode.Tab[] = [];

	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (includeSingle && isPlaceholderSingleTab(tab, key)) {
				toClose.push(tab);
				continue;
			}

			if (includeDiff && isPlaceholderDiffTab(tab, key)) {
				toClose.push(tab);
				continue;
			}

			if (includeCustom && isPlaceholderCustomTab(tab, key)) {
				toClose.push(tab);
			}
		}
	}

	return toClose;
}

export async function closePlaceholderRobloxTabs(
	fileUri: vscode.Uri,
	options?: {
		single?: boolean;
		diff?: boolean;
		custom?: boolean;
	},
): Promise<number> {
	const toClose = collectPlaceholderTabs(fileUri, options);
	if (toClose.length === 0) {
		return 0;
	}

	await vscode.window.tabGroups.close(toClose);
	return toClose.length;
}

export function viewColumnForTab(tab?: vscode.Tab): vscode.ViewColumn | undefined {
	return tab?.group.viewColumn;
}
