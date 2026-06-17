import * as vscode from 'vscode';
import { errorMessage } from './errorMessage';
import { isInDiffContext } from './diffGuard';
import type { FileviewTextDocumentProvider } from './fileviewTextDocumentProvider';
import type { GitRef } from './gitRefDump';
import { isFileviewUri, isRobloxFile, normalizeRobloxFileUri } from './fileviewUri';
import { gitRefFromTabUri, robloxFileKey, robloxFileUriFromTabUri } from './robloxUri';
import {
	closePlaceholderRobloxTabs,
	closeTabIfPresent,
	findFileviewDiffTab,
	findFileviewSingleTab,
	focusTab,
	viewColumnForTab,
} from './robloxTabs';
import { openFileviewDocument, openFileviewDocumentAtRef } from './openRobloxFile';
import { markScmOriginatedOpen } from './scmOpenContext';
import { openGitChanges, openGitRefsDiff } from './scmDiff';

const handledFiles = new Set<string>();

type RobloxOpenIntent = 'explorer' | 'scmDiff';

function isFileviewDiffTab(tab: vscode.Tab): boolean {
	if (!(tab.input instanceof vscode.TabInputTextDiff)) {
		return false;
	}

	return isFileviewUri(tab.input.original) || isFileviewUri(tab.input.modified);
}

function robloxDiffFromTab(tab: vscode.Tab): { fileUri: vscode.Uri; leftRef: GitRef; rightRef: GitRef } | undefined {
	if (!(tab.input instanceof vscode.TabInputTextDiff)) {
		return undefined;
	}

	const { original, modified } = tab.input;
	const fileUri = robloxFileUriFromTabUri(original) ?? robloxFileUriFromTabUri(modified);
	if (!fileUri) {
		return undefined;
	}

	return {
		fileUri,
		leftRef: gitRefFromTabUri(original),
		rightRef: gitRefFromTabUri(modified),
	};
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

function routeKey(fileUri: vscode.Uri, refs?: { leftRef: GitRef; rightRef: GitRef }): string {
	const base = robloxFileKey(fileUri);
	if (!refs) {
		return base;
	}

	return `${base}\0${refs.leftRef}\0${refs.rightRef}`;
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
	options?: {
		sourceTab?: vscode.Tab;
		leftRef?: GitRef;
		rightRef?: GitRef;
	},
): Promise<boolean> {
	const existing =
		intent === 'scmDiff'
			? findFileviewDiffTab(fileUri, {
					leftRef: options?.leftRef ?? 'HEAD',
					rightRef: options?.rightRef ?? 'WORKTREE',
				})
			: findFileviewSingleTab(fileUri);
	if (!existing) {
		return false;
	}

	await closePlaceholderRobloxTabs(fileUri, {
		single: intent === 'explorer',
		diff: intent === 'scmDiff',
		custom: true,
	});

	if (options?.sourceTab && options.sourceTab !== existing) {
		await closeTabIfPresent(options.sourceTab);
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
		leftRef?: GitRef;
		rightRef?: GitRef;
	},
): Promise<void> {
	const intent = options?.intent ?? 'explorer';
	const normalized = normalizeRobloxFileUri(fileUri);
	const leftRef = options?.leftRef;
	const rightRef = options?.rightRef;
	const key = routeKey(normalized, leftRef && rightRef ? { leftRef, rightRef } : undefined);

	markScmOriginatedOpen(normalized);

	if (
		await focusExistingView(normalized, intent, textProvider, {
			sourceTab: options?.sourceTab,
			leftRef,
			rightRef,
		})
	) {
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
		await sweepPlaceholderTabs(normalized, intent);

		if (intent === 'scmDiff' && leftRef && rightRef) {
			output.appendLine(
				`Routing Roblox git diff to rbx-fileview: ${normalized.fsPath} (${leftRef} ↔ ${rightRef})`,
			);
			await openGitRefsDiff(normalized, leftRef, rightRef, output, { viewColumn });
		} else if (intent === 'scmDiff') {
			output.appendLine(`Routing SCM Roblox diff to rbx-fileview: ${normalized.fsPath}`);
			await openGitChanges(normalized, output, { viewColumn });
		} else {
			output.appendLine(`Routing Roblox file to RBX-Fileview text view: ${normalized.fsPath}`);
			await openFileviewDocument(normalized, output, { viewColumn, preview: false }, textProvider);
		}

		void schedulePlaceholderSweep(normalized, intent);
	} catch (error) {
		const message = errorMessage(error);
		output.appendLine(`Roblox open routing failed: ${message}`);
		void vscode.window.showErrorMessage(`RBX-Fileview failed to open Roblox file: ${message}`);
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

				const diff = robloxDiffFromTab(tab);
				if (!diff) {
					continue;
				}

				void routeRobloxFileOpen(diff.fileUri, output, textProvider, {
					intent: 'scmDiff',
					sourceTab: tab,
					leftRef: diff.leftRef,
					rightRef: diff.rightRef,
				});
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

				const ref = gitRefFromTabUri(tab.input.uri);
				if (ref !== 'WORKTREE') {
					output.appendLine(`Routing Roblox git revision to rbx-fileview: ${fileUri.fsPath} (${ref})`);
					void openFileviewDocumentAtRef(fileUri, ref, output, { viewColumn: viewColumnForTab(tab), preview: false }, textProvider);
					void closeTabIfPresent(tab);
					continue;
				}

				void routeRobloxFileOpen(fileUri, output, textProvider, { intent: 'explorer', sourceTab: tab });
			}
		}
	});
}
