import * as vscode from 'vscode';
import { isDiffOperationActive } from './diffGuard';
import { isLupaUri, normalizeRobloxFileUri } from './lupaUri';
import { robloxFileKey, robloxFileUriFromTabUri } from './robloxUri';
import {
	closeNonLupaRobloxDiffTabsForFileWithRetry,
	findLupaDiffTab,
	focusTab,
	viewColumnForTab,
	waitForLupaDiffTab,
} from './robloxTabs';
import { openGitChanges } from './scmDiff';

const handledFiles = new Set<string>();

function isLupaDiffTab(tab: vscode.Tab): boolean {
	if (!(tab.input instanceof vscode.TabInputTextDiff)) {
		return false;
	}

	return isLupaUri(tab.input.original) || isLupaUri(tab.input.modified);
}

function robloxFileFromDiffTab(tab: vscode.Tab): vscode.Uri | undefined {
	if (!(tab.input instanceof vscode.TabInputTextDiff)) {
		return undefined;
	}

	return (
		robloxFileUriFromTabUri(tab.input.original) ?? robloxFileUriFromTabUri(tab.input.modified)
	);
}

async function routeScmDiffOpen(
	fileUri: vscode.Uri,
	output: vscode.OutputChannel,
	sourceTab: vscode.Tab,
): Promise<void> {
	const normalized = normalizeRobloxFileUri(fileUri);
	const key = robloxFileKey(normalized);

	if (handledFiles.has(key)) {
		return;
	}

	const existing = findLupaDiffTab(normalized);
	if (existing) {
		await closeNonLupaRobloxDiffTabsForFileWithRetry(normalized);
		await focusTab(existing);
		return;
	}

	const config = vscode.workspace.getConfiguration('lupa');
	if (!config.get<boolean>('openDiffForChangedFiles', true)) {
		return;
	}

	handledFiles.add(key);

	try {
		output.appendLine(`Routing SCM Roblox diff to Lupa: ${normalized.fsPath}`);
		await openGitChanges(normalized, output, { viewColumn: viewColumnForTab(sourceTab) });
		await waitForLupaDiffTab(normalized);
		await closeNonLupaRobloxDiffTabsForFileWithRetry(normalized);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		output.appendLine(`SCM diff routing failed: ${message}`);
	} finally {
		setTimeout(() => {
			handledFiles.delete(key);
		}, 2000);
	}
}

export function setupScmDiffRouter(output: vscode.OutputChannel): vscode.Disposable {
	return vscode.window.tabGroups.onDidChangeTabs((event) => {
		if (isDiffOperationActive()) {
			return;
		}

		for (const tab of event.opened) {
			if (!(tab.input instanceof vscode.TabInputTextDiff)) {
				continue;
			}

			if (isLupaDiffTab(tab)) {
				continue;
			}

			const fileUri = robloxFileFromDiffTab(tab);
			if (!fileUri) {
				continue;
			}

			void routeScmDiffOpen(fileUri, output, tab);
		}
	});
}
