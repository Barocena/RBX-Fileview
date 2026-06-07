import * as path from 'node:path';
import * as vscode from 'vscode';
import { LUPA_VIEW_TYPE } from './editorAssociations';
import { fromLupaUri, isLupaUri, isRobloxFile } from './lupaUri';
import { robloxFileKey, robloxFileUriFromTabUri } from './robloxUri';

export function tabLabel(tab: vscode.Tab): string {
	if (typeof tab.label === 'string') {
		return tab.label;
	}

	if (tab.label && typeof tab.label === 'object' && 'label' in tab.label) {
		return String((tab.label as { label: string }).label);
	}

	return '';
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

export function viewColumnForTab(tab?: vscode.Tab): vscode.ViewColumn | undefined {
	return tab?.group.viewColumn;
}

export async function waitForLupaDiffTab(
	fileUri: vscode.Uri,
	timeoutMs = 5000,
): Promise<vscode.Tab | undefined> {
	const started = Date.now();

	while (Date.now() - started < timeoutMs) {
		const tab = findLupaDiffTab(fileUri);
		if (tab) {
			return tab;
		}

		await new Promise((resolve) => setTimeout(resolve, 50));
	}

	return undefined;
}

export function isNonLupaRobloxDiffTab(tab: vscode.Tab, fileUri: vscode.Uri): boolean {
	if (!(tab.input instanceof vscode.TabInputTextDiff)) {
		return false;
	}

	const { original, modified } = tab.input;
	if (isLupaUri(original) || isLupaUri(modified)) {
		return false;
	}

	const key = robloxFileKey(fileUri);
	const basename = path.basename(fileUri.fsPath).toLowerCase();
	const label = tabLabel(tab).toLowerCase();

	if (label.includes(basename)) {
		return true;
	}

	for (const side of [original, modified]) {
		const sideFile = robloxFileUriFromTabUri(side);
		if (sideFile && robloxFileKey(sideFile) === key) {
			return true;
		}
	}

	return false;
}

async function closeMatchingTabs(tabs: vscode.Tab[]): Promise<void> {
	for (const tab of tabs) {
		await vscode.window.tabGroups.close(tab);
	}
}

export async function closeNonLupaRobloxDiffTabsForFile(fileUri: vscode.Uri): Promise<void> {
	const tabsToClose: vscode.Tab[] = [];

	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (isNonLupaRobloxDiffTab(tab, fileUri)) {
				tabsToClose.push(tab);
			}
		}
	}

	await closeMatchingTabs(tabsToClose);
}

export async function closeNonLupaRobloxDiffTabsForFileWithRetry(
	fileUri: vscode.Uri,
	attempts = 12,
	delayMs = 150,
): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		await closeNonLupaRobloxDiffTabsForFile(fileUri);
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}
}

export async function closeExplorerPlaceholderTabsForFile(fileUri: vscode.Uri): Promise<void> {
	const key = robloxFileKey(fileUri);
	const lupaTab = findLupaSingleTab(fileUri);
	const tabsToClose: vscode.Tab[] = [];

	for (const group of vscode.window.tabGroups.all) {
		for (const tab of group.tabs) {
			if (tab === lupaTab) {
				continue;
			}

			if (tab.input instanceof vscode.TabInputText && isRobloxFile(tab.input.uri)) {
				if (robloxFileKey(tab.input.uri) === key) {
					tabsToClose.push(tab);
				}
				continue;
			}

			if (tab.input instanceof vscode.TabInputCustom && tab.input.viewType === LUPA_VIEW_TYPE) {
				if (isRobloxFile(tab.input.uri) && robloxFileKey(tab.input.uri) === key) {
					tabsToClose.push(tab);
				}
			}
		}
	}

	await closeMatchingTabs(tabsToClose);
}

export async function closeExplorerPlaceholderTabsForFileWithRetry(
	fileUri: vscode.Uri,
	attempts = 8,
	delayMs = 100,
): Promise<void> {
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		await closeExplorerPlaceholderTabsForFile(fileUri);
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}
}
