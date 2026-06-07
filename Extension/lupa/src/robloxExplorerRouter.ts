import * as vscode from 'vscode';
import { isDiffOperationActive } from './diffGuard';
import { LUPA_VIEW_TYPE } from './editorAssociations';
import { isLupaUri, isRobloxFile, normalizeRobloxFileUri } from './lupaUri';
import { openLupaDocument } from './openRobloxFile';
import { robloxFileKey } from './robloxUri';
import {
	closeExplorerPlaceholderTabsForFileWithRetry,
	findLupaSingleTab,
	focusTab,
	viewColumnForTab,
} from './robloxTabs';

const handledExplorerOpens = new Set<string>();

function isExplorerRobloxTab(tab: vscode.Tab): boolean {
	if (tab.input instanceof vscode.TabInputText) {
		return isRobloxFile(tab.input.uri);
	}

	if (tab.input instanceof vscode.TabInputCustom) {
		return tab.input.viewType === LUPA_VIEW_TYPE && isRobloxFile(tab.input.uri);
	}

	return false;
}

function fileUriFromExplorerTab(tab: vscode.Tab): vscode.Uri | undefined {
	if (tab.input instanceof vscode.TabInputText && isRobloxFile(tab.input.uri)) {
		return normalizeRobloxFileUri(tab.input.uri);
	}

	if (tab.input instanceof vscode.TabInputCustom && tab.input.viewType === LUPA_VIEW_TYPE) {
		return isRobloxFile(tab.input.uri) ? normalizeRobloxFileUri(tab.input.uri) : undefined;
	}

	return undefined;
}

async function routeExplorerOpen(
	fileUri: vscode.Uri,
	output: vscode.OutputChannel,
	sourceTab: vscode.Tab,
): Promise<void> {
	const normalized = normalizeRobloxFileUri(fileUri);
	const key = robloxFileKey(normalized);

	if (handledExplorerOpens.has(key)) {
		return;
	}

	const config = vscode.workspace.getConfiguration('lupa');
	if (!config.get<boolean>('openByDefault', true)) {
		return;
	}

	handledExplorerOpens.add(key);

	try {
		const existing = findLupaSingleTab(normalized);
		if (existing) {
			output.appendLine(`Focusing existing Lupa view from explorer: ${normalized.fsPath}`);
			await closeExplorerPlaceholderTabsForFileWithRetry(normalized);
			await focusTab(existing);
			return;
		}

		output.appendLine(`Opening Lupa view from explorer: ${normalized.fsPath}`);
		await openLupaDocument(normalized, output, {
			viewColumn: viewColumnForTab(sourceTab),
			preview: false,
		});
		await closeExplorerPlaceholderTabsForFileWithRetry(normalized);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		output.appendLine(`Explorer routing failed: ${message}`);
	} finally {
		setTimeout(() => {
			handledExplorerOpens.delete(key);
		}, 2000);
	}
}

export function setupExplorerTabRouter(output: vscode.OutputChannel): vscode.Disposable {
	return vscode.window.tabGroups.onDidChangeTabs((event) => {
		if (isDiffOperationActive()) {
			return;
		}

		for (const tab of event.opened) {
			if (tab.input instanceof vscode.TabInputTextDiff) {
				continue;
			}

			if (tab.input instanceof vscode.TabInputText && isLupaUri(tab.input.uri)) {
				continue;
			}

			if (!isExplorerRobloxTab(tab)) {
				continue;
			}

			const fileUri = fileUriFromExplorerTab(tab);
			if (!fileUri) {
				continue;
			}

			void routeExplorerOpen(fileUri, output, tab);
		}
	});
}
