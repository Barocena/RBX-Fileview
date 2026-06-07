import * as vscode from 'vscode';
import { robloxFileKey, robloxFileUriFromTabUri } from './robloxUri';
import { fromLupaUri, isLupaUri } from './lupaUri';

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

export function findLupaSingleTab(fileUri: vscode.Uri): vscode.Tab | undefined {
	const key = robloxFileKey(fileUri);

	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (!(tab.input instanceof vscode.TabInputText)) {
				continue;
			}

			if (!isLupaUri(tab.input.uri) || tab.input.uri.query) {
				continue;
			}

			if (robloxFileKey(fromLupaUri(tab.input.uri)) === key) {
				return tab;
			}
		}
	}

	return undefined;
}

export function findLupaDiffTab(fileUri: vscode.Uri): vscode.Tab | undefined {
	const key = robloxFileKey(fileUri);

	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (!(tab.input instanceof vscode.TabInputTextDiff)) {
				continue;
			}

			const { original, modified } = tab.input;
			if (!isLupaUri(original) && !isLupaUri(modified)) {
				continue;
			}

			for (const side of [original, modified]) {
				if (isLupaUri(side) && robloxFileKey(fromLupaUri(side)) === key) {
					return tab;
				}
			}
		}
	}

	return undefined;
}

export async function focusTab(tab: vscode.Tab): Promise<void> {
	if (tab.input instanceof vscode.TabInputText) {
		const document = await vscode.workspace.openTextDocument(tab.input.uri);
		await vscode.window.showTextDocument(document, {
			viewColumn: tab.group.viewColumn,
			preview: false,
		});
		return;
	}

	if (tab.input instanceof vscode.TabInputTextDiff) {
		const document = await vscode.workspace.openTextDocument(tab.input.modified);
		await vscode.window.showTextDocument(document, {
			viewColumn: tab.group.viewColumn,
			preview: false,
		});
	}
}

export async function closeTabIfPresent(tab: vscode.Tab): Promise<void> {
	for (const group of vscode.window.tabGroups.all) {
		if (group.tabs.includes(tab)) {
			await vscode.window.tabGroups.close(tab);
			return;
		}
	}
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
