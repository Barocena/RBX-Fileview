import * as vscode from 'vscode';
import { errorMessage } from './errorMessage';
import {
	compareActiveWith,
	compareWith,
	compareWithSelected,
	selectForCompare,
	setCompareSourceContext,
} from './compare';
import { ensureBundledCli, isBundledCliEnabled } from './bundledCli';
import { setupGitDiffSupport } from './gitDiffSetup';
import { setExtensionContext, setManagedCliPath } from './fileviewCli';
import { FileviewTextDocumentProvider } from './fileviewTextDocumentProvider';
import { isFileviewUri, isRobloxFile, FILEVIEW_SCHEME } from './fileviewUri';
import { applyDumpLanguage, openFileviewDocument } from './openRobloxFile';
import { setupRobloxTabRouter } from './robloxTabRouter';
import { RobloxCustomEditorProvider } from './robloxCustomEditorProvider';
import { openGitChanges } from './scmDiff';
import { revealFileviewSourceInExplorer } from './revealSourceInExplorer';

function updateActiveDumpContext(): void {
	const active = vscode.window.activeTextEditor?.document.uri;
	const isActive = active !== undefined && isFileviewUri(active);
	void vscode.commands.executeCommand('setContext', 'rbx-fileview.dumpActive', isActive);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const output = vscode.window.createOutputChannel('rbx-fileview');

	try {
		output.appendLine('RBX-Fileview extension activating...');

		setExtensionContext(context);

		if (isBundledCliEnabled()) {
			const managedCliPath = await ensureBundledCli(context);
			setManagedCliPath(managedCliPath);
			if (managedCliPath) {
				output.appendLine(`Using bundled CLI: ${managedCliPath}`);
			}
		} else {
			output.appendLine('Using rbx-fileview from PATH (bundled CLI disabled).');
		}

		if (context.extensionMode === vscode.ExtensionMode.Development) {
			output.show(true);
			void vscode.window.showInformationMessage('RBX-Fileview extension loaded (development mode)');
		}

		const textProvider = new FileviewTextDocumentProvider();
		textProvider.setOutputChannel(output);
		const customEditorProvider = new RobloxCustomEditorProvider(output, textProvider);

		const refreshActiveDump = () => {
			const active = vscode.window.activeTextEditor?.document.uri;
			textProvider.refresh(active);
		};

		setCompareSourceContext(false);

		context.subscriptions.push(
			output,
			textProvider,
			vscode.window.registerCustomEditorProvider('rbx-fileview.roblox', customEditorProvider, {
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
			vscode.workspace.onDidCloseTextDocument(() => {
				updateActiveDumpContext();
			}),
			setupRobloxTabRouter(output, textProvider),
			vscode.commands.registerCommand('rbx-fileview.refresh', refreshActiveDump),
			vscode.commands.registerCommand('rbx-fileview.copyDump', async () => {
				const document = vscode.window.activeTextEditor?.document;
				if (!document || !isFileviewUri(document.uri)) {
					void vscode.window.showWarningMessage('No rbx-fileview dump is open to copy.');
					return;
				}

				await vscode.env.clipboard.writeText(document.getText());
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

export function deactivate() {}
