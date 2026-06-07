import * as vscode from 'vscode';
import { isInDiffContext } from './diffGuard';
import { isLupaUri, normalizeRobloxFileUri } from './lupaUri';
import { robloxFileKey, robloxFileUriFromTabUri } from './robloxUri';
import {
	closePlaceholderRobloxTabs,
	closeTabIfPresent,
	findLupaDiffTab,
	findLupaSingleTab,
	focusTab,
	viewColumnForTab,
} from './robloxTabs';
import { openLupaDocument } from './openRobloxFile';
import { openGitChanges } from './scmDiff';

const handledFiles = new Set<string>();

type RobloxOpenIntent = 'explorer' | 'scmDiff';

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

async function sweepPlaceholderTabs(fileUri: vscode.Uri, intent: RobloxOpenIntent): Promise<void> {
	await closePlaceholderRobloxTabs(fileUri, {
		single: intent === 'explorer',
		diff: intent === 'scmDiff',
		custom: true,
	});
}

async function schedulePlaceholderSweep(fileUri: vscode.Uri, intent: RobloxOpenIntent): Promise<void> {
	for (const delay of [0, 75, 200]) {
		if (delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
		await sweepPlaceholderTabs(fileUri, intent);
	}
}

async function focusExistingView(
	fileUri: vscode.Uri,
	intent: RobloxOpenIntent,
	sourceTab?: vscode.Tab,
): Promise<boolean> {
	const existing = intent === 'scmDiff' ? findLupaDiffTab(fileUri) : findLupaSingleTab(fileUri);
	if (!existing) {
		return false;
	}

	await closePlaceholderRobloxTabs(fileUri, {
		single: intent === 'explorer',
		diff: intent === 'scmDiff',
		custom: true,
	});

	if (sourceTab && sourceTab !== existing) {
		await closeTabIfPresent(sourceTab);
	}

	await focusTab(existing);
	return true;
}

export async function routeRobloxFileOpen(
	fileUri: vscode.Uri,
	output: vscode.OutputChannel,
	options?: {
		intent?: RobloxOpenIntent;
		sourceTab?: vscode.Tab;
	},
): Promise<void> {
	const intent = options?.intent ?? 'explorer';
	const normalized = normalizeRobloxFileUri(fileUri);
	const key = robloxFileKey(normalized);

	if (handledFiles.has(key)) {
		return;
	}

	if (await focusExistingView(normalized, intent, options?.sourceTab)) {
		return;
	}

	if (intent === 'explorer' && isInDiffContext(normalized)) {
		return;
	}

	handledFiles.add(key);

	const viewColumn = viewColumnForTab(options?.sourceTab);

	try {
		const config = vscode.workspace.getConfiguration('lupa');
		const openByDefault = config.get<boolean>('openByDefault', true);
		const openScmDiff = config.get<boolean>('openDiffForChangedFiles', true);

		await sweepPlaceholderTabs(normalized, intent);

		if (intent === 'scmDiff') {
			if (!openScmDiff) {
				return;
			}

			output.appendLine(`Routing SCM Roblox diff to Lupa: ${normalized.fsPath}`);
			await openGitChanges(normalized, output, { viewColumn });
		} else if (openByDefault) {
			output.appendLine(`Routing Roblox file to Lupa text view: ${normalized.fsPath}`);
			await openLupaDocument(normalized, output, { viewColumn, preview: false });
		} else {
			return;
		}

		void schedulePlaceholderSweep(normalized, intent);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		output.appendLine(`Roblox open routing failed: ${message}`);
	} finally {
		setTimeout(() => {
			handledFiles.delete(key);
		}, 2000);
	}
}

export function setupRobloxTabRouter(output: vscode.OutputChannel): vscode.Disposable {
	return vscode.window.tabGroups.onDidChangeTabs((event) => {
		for (const tab of event.opened) {
			if (tab.input instanceof vscode.TabInputTextDiff) {
				if (isLupaDiffTab(tab)) {
					continue;
				}

				const fileUri = robloxFileFromDiffTab(tab);
				if (!fileUri) {
					continue;
				}

				void routeRobloxFileOpen(fileUri, output, { intent: 'scmDiff', sourceTab: tab });
				continue;
			}

			if (tab.input instanceof vscode.TabInputText) {
				const fileUri = robloxFileUriFromTabUri(tab.input.uri);
				if (!fileUri) {
					continue;
				}

				void routeRobloxFileOpen(fileUri, output, { intent: 'explorer', sourceTab: tab });
			}
		}
	});
}
