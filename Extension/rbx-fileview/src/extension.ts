import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import { errorMessage } from './errorMessage';
import {
	compareActiveWith,
	compareWith,
	compareWithSelected,
	selectForCompare,
	setCompareSourceContext,
} from './compare';
import { setupGitDiffSupport } from './gitDiffSetup';
import { notifyIfCliMissing } from './fileviewCli';
import { FileviewTextDocumentProvider } from './fileviewTextDocumentProvider';
import { isFileviewUri, isRobloxFile, FILEVIEW_SCHEME, FILEVIEW_CUSTOM_EDITOR_VIEW_TYPE } from './fileviewUri';
import { applyDumpLanguage, openFileviewDocument } from './openRobloxFile';
import { setupRobloxTabRouter } from './robloxTabRouter';
import { RobloxCustomEditorProvider } from './robloxCustomEditorProvider';
import { openGitChanges } from './scmDiff';
import { revealFileviewSourceInExplorer } from './revealSourceInExplorer';
import { disposeSpillDirectory, isSpillDumpUri, scheduleSpillCleanup, sweepOldSpillFiles } from './spillRegistry';

function updateActiveDumpContext(): void {
	const active = vscode.window.activeTextEditor?.document.uri;
	const isActive = active !== undefined && (isFileviewUri(active) || isSpillDumpUri(active));
	void vscode.commands.executeCommand('setContext', 'rbx-fileview.dumpActive', isActive);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const output = vscode.window.createOutputChannel('rbx-fileview');

	try {
		output.appendLine('RBX-Fileview extension activating...');

		void notifyIfCliMissing(output);

		if (context.extensionMode === vscode.ExtensionMode.Development) {
			output.show(true);
		}

		const textProvider = new FileviewTextDocumentProvider();
		textProvider.setOutputChannel(output);
		const customEditorProvider = new RobloxCustomEditorProvider(output, textProvider);

		const refreshActiveDump = () => {
			const active = vscode.window.activeTextEditor?.document.uri;
			textProvider.refresh(active);
		};

		setCompareSourceContext(false);

		void sweepOldSpillFiles().then((removed) => {
			if (removed > 0) {
				output.appendLine(`Removed ${removed} stale spill dump(s) from temp.`);
			}
		});

		context.subscriptions.push(
			output,
			textProvider,
			vscode.window.registerCustomEditorProvider(FILEVIEW_CUSTOM_EDITOR_VIEW_TYPE, customEditorProvider, {
				supportsMultipleEditorsPerDocument: true,
			}),
			vscode.workspace.registerTextDocumentContentProvider(FILEVIEW_SCHEME, textProvider),
			vscode.workspace.onDidOpenTextDocument((document) => {
				void applyDumpLanguage(document);
			}),
			vscode.window.onDidChangeActiveTextEditor((editor) => {
				updateActiveDumpContext();
				void revealFileviewSourceInExplorer(editor?.document.uri);
			}),
			vscode.workspace.onDidCloseTextDocument((document) => {
				if (isSpillDumpUri(document.uri)) {
					scheduleSpillCleanup(document.uri.fsPath);
				}
				updateActiveDumpContext();
			}),
			vscode.workspace.onDidChangeConfiguration((event) => {
				if (event.affectsConfiguration('rbx-fileview')) {
					void textProvider.invalidateSettings();
				}
			}),
			setupRobloxTabRouter(output, textProvider),
			vscode.commands.registerCommand('rbx-fileview.refresh', refreshActiveDump),
			vscode.commands.registerCommand('rbx-fileview.copyDump', async () => {
				const document = vscode.window.activeTextEditor?.document;
				if (!document || (!isFileviewUri(document.uri) && !isSpillDumpUri(document.uri))) {
					void vscode.window.showWarningMessage('No rbx-fileview dump is open to copy.');
					return;
				}

				if (isSpillDumpUri(document.uri)) {
					const text = await fs.readFile(document.uri.fsPath, 'utf8');
					await vscode.env.clipboard.writeText(text);
				} else {
					await vscode.env.clipboard.writeText(document.getText());
				}
				void vscode.window.showInformationMessage('RBX-Fileview dump copied to clipboard.');
			}),
			vscode.commands.registerCommand('rbx-fileview.openWith', async (uri?: vscode.Uri) => {
				const target = uri ?? vscode.window.activeTextEditor?.document.uri;
				if (!target) {
					void vscode.window.showWarningMessage('No Roblox file selected to open.');
					return;
				}

				const fileUri = isFileviewUri(target) ? target.with({ scheme: 'file' }) : target;
				if (!isRobloxFile(fileUri)) {
					void vscode.window.showWarningMessage('The selected file is not a Roblox place or model.');
					return;
				}

				await openFileviewDocument(fileUri, output, undefined, textProvider);
			}),
			vscode.commands.registerCommand('rbx-fileview.openGitChanges', (uri?: vscode.Uri) => openGitChanges(uri, output)),
			vscode.commands.registerCommand('rbx-fileview.selectForCompare', (uri?: vscode.Uri) => selectForCompare(uri)),
			vscode.commands.registerCommand('rbx-fileview.compareWithSelected', (uri?: vscode.Uri) =>
				compareWithSelected(uri, output),
			),
			vscode.commands.registerCommand('rbx-fileview.compareWith', (uri?: vscode.Uri) => compareWith(uri, output)),
			vscode.commands.registerCommand('rbx-fileview.compareActiveWith', () => compareActiveWith(output)),
		);

		updateActiveDumpContext();
		output.appendLine('RBX-Fileview extension activated.');
		output.appendLine('Ready. Open a .rbxm file or run "RBX-Fileview: Open with RBX-Fileview".');

		void setupGitDiffSupport(output).catch((error: unknown) => {
			output.appendLine(`Git setup failed: ${errorMessage(error)}`);
		});
	} catch (error) {
		output.appendLine(`Activation failed: ${errorMessage(error)}`);
		void vscode.window.showErrorMessage(`RBX-Fileview extension failed to activate: ${errorMessage(error)}`);
		throw error;
	}
}

export function deactivate() {
	void disposeSpillDirectory();
}
