import * as vscode from 'vscode';
import { errorMessage } from './errorMessage';
import { isInDiffContext } from './diffGuard';
import type { FileviewTextDocumentProvider } from './fileviewTextDocumentProvider';
import { isFileviewUri, isRobloxFile, normalizeRobloxFileUri } from './fileviewUri';
import { robloxFileKey, robloxFileUriFromTabUri } from './robloxUri';
import {
	closePlaceholderRobloxTabs,
	closeTabIfPresent,
	findFileviewDiffTab,
	findFileviewSingleTab,
	focusTab,
	viewColumnForTab,
} from './robloxTabs';
import { openFileviewDocument } from './openRobloxFile';
import { openGitChanges } from './scmDiff';

const handledFiles = new Set<string>();

type RobloxOpenIntent = 'explorer' | 'scmDiff';

function isFileviewDiffTab(tab: vscode.Tab): boolean {
	if (!(tab.input instanceof vscode.TabInputTextDiff)) {
		return false;
	}

	return isFileviewUri(tab.input.original) || isFileviewUri(tab.input.modified);
}

function robloxFileFromDiffTab(tab: vscode.Tab): vscode.Uri | undefined {
	if (!(tab.input instanceof vscode.TabInputTextDiff)) {
		return undefined;
	}

	return (
		robloxFileUriFromTabUri(tab.input.original) ?? robloxFileUriFromTabUri(tab.input.modified)
	);
}

function robloxFileFromCustomTab(tab: vscode.Tab): vscode.Uri | undefined {
	if (!(tab.input instanceof vscode.TabInputCustom)) {
		return undefined;
	}

	if (!isRobloxFile(tab.input.uri)) {
		return undefined;
	}

	return normalizeRobloxFileUri(tab.input.uri);
}

async function sweepPlaceholderTabs(fileUri: vscode.Uri, intent: RobloxOpenIntent): Promise<void> {
	await closePlaceholderRobloxTabs(fileUri, {
		single: intent === 'explorer',
		diff: intent === 'scmDiff',
		custom: true,
	});
}

async function schedulePlaceholderSweep(fileUri: vscode.Uri, intent: RobloxOpenIntent): Promise<void> {
	for (const delay of [0, 75, 200, 400]) {
		if (delay > 0) {
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
		await sweepPlaceholderTabs(fileUri, intent);
	}
}

async function focusExistingView(
	fileUri: vscode.Uri,
	intent: RobloxOpenIntent,
	textProvider: FileviewTextDocumentProvider | undefined,
	sourceTab?: vscode.Tab,
): Promise<boolean> {
	const existing = intent === 'scmDiff' ? findFileviewDiffTab(fileUri) : findFileviewSingleTab(fileUri);
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

	await focusTab(existing, textProvider);
	return true;
}

export async function routeRobloxFileOpen(
	fileUri: vscode.Uri,
	output: vscode.OutputChannel,
	textProvider?: FileviewTextDocumentProvider,
	options?: {
		intent?: RobloxOpenIntent;
		sourceTab?: vscode.Tab;
	},
): Promise<void> {
	const intent = options?.intent ?? 'explorer';
	const normalized = normalizeRobloxFileUri(fileUri);
	const key = robloxFileKey(normalized);

	// Always refocus an existing RBX-Fileview tab — even during the new-open debounce window.
	if (await focusExistingView(normalized, intent, textProvider, options?.sourceTab)) {
		return;
	}

	if (handledFiles.has(key)) {
		return;
	}

	if (intent === 'explorer' && isInDiffContext(normalized)) {
		return;
	}

	handledFiles.add(key);

	const viewColumn = viewColumnForTab(options?.sourceTab);

	try {
		const config = vscode.workspace.getConfiguration('rbx-fileview');
		const openByDefault = config.get<boolean>('openByDefault', true);
		const openScmDiff = config.get<boolean>('openDiffForChangedFiles', true);

		await sweepPlaceholderTabs(normalized, intent);

		if (intent === 'scmDiff') {
			if (!openScmDiff) {
				return;
			}

			output.appendLine(`Routing SCM Roblox diff to rbx-fileview: ${normalized.fsPath}`);
			await openGitChanges(normalized, output, { viewColumn });
		} else if (openByDefault) {
			output.appendLine(`Routing Roblox file to RBX-Fileview text view: ${normalized.fsPath}`);
			await openFileviewDocument(normalized, output, { viewColumn, preview: false }, textProvider);
		} else {
			return;
		}

		void schedulePlaceholderSweep(normalized, intent);
	} catch (error) {
		output.appendLine(`Roblox open routing failed: ${errorMessage(error)}`);
	} finally {
		setTimeout(() => {
			handledFiles.delete(key);
		}, 2000);
	}
}

export function setupRobloxTabRouter(
	output: vscode.OutputChannel,
	textProvider?: FileviewTextDocumentProvider,
): vscode.Disposable {
	return vscode.window.tabGroups.onDidChangeTabs((event) => {
		for (const tab of event.opened) {
			if (tab.input instanceof vscode.TabInputTextDiff) {
				if (isFileviewDiffTab(tab)) {
					continue;
				}

				const fileUri = robloxFileFromDiffTab(tab);
				if (!fileUri) {
					continue;
				}

				void routeRobloxFileOpen(fileUri, output, textProvider, { intent: 'scmDiff', sourceTab: tab });
				continue;
			}

			if (tab.input instanceof vscode.TabInputCustom) {
				const fileUri = robloxFileFromCustomTab(tab);
				if (!fileUri) {
					continue;
				}

				void routeRobloxFileOpen(fileUri, output, textProvider, { intent: 'explorer', sourceTab: tab });
				continue;
			}

			if (tab.input instanceof vscode.TabInputText) {
				const fileUri = robloxFileUriFromTabUri(tab.input.uri);
				if (!fileUri) {
					continue;
				}

				void routeRobloxFileOpen(fileUri, output, textProvider, { intent: 'explorer', sourceTab: tab });
			}
		}
	});
}
