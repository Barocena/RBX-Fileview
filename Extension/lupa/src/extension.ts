import * as vscode from 'vscode';
import {
	compareActiveWith,
	compareWith,
	compareWithSelected,
	selectForCompare,
	setCompareSourceContext,
} from './compare';
import { setupGitDiffSupport } from './gitDiffSetup';
import { LupaTextDocumentProvider } from './lupaTextDocumentProvider';
import { isLupaUri, isRobloxFile, LUPA_SCHEME } from './lupaUri';
import { applyDumpLanguage, openLupaDocument } from './openRobloxFile';
import { setupRobloxTabRouter } from './robloxTabRouter';
import { RobloxCustomEditorProvider } from './robloxCustomEditorProvider';
import { openGitChanges } from './scmDiff';

function updateActiveDumpContext(): void {
	const active = vscode.window.activeTextEditor?.document.uri;
	const isActive = active !== undefined && isLupaUri(active);
	void vscode.commands.executeCommand('setContext', 'lupa.dumpActive', isActive);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const output = vscode.window.createOutputChannel('Lupa');

	try {
		output.appendLine('Lupa extension activating...');
		output.show(true);

		if (context.extensionMode === vscode.ExtensionMode.Development) {
			void vscode.window.showInformationMessage('Lupa extension loaded (development mode)');
		}

		const textProvider = new LupaTextDocumentProvider();
		textProvider.setOutputChannel(output);
		const customEditorProvider = new RobloxCustomEditorProvider(output);

		const refreshActiveDump = () => {
			const active = vscode.window.activeTextEditor?.document.uri;
			textProvider.refresh(active);
		};

		setCompareSourceContext(false);

		context.subscriptions.push(
			output,
			textProvider,
			vscode.window.registerCustomEditorProvider('lupa.roblox', customEditorProvider, {
				supportsMultipleEditorsPerDocument: true,
			}),
			vscode.workspace.registerTextDocumentContentProvider(LUPA_SCHEME, textProvider),
			vscode.workspace.onDidOpenTextDocument((document) => {
				void applyDumpLanguage(document);
			}),
			vscode.window.onDidChangeActiveTextEditor(() => {
				updateActiveDumpContext();
			}),
			vscode.workspace.onDidCloseTextDocument(() => {
				updateActiveDumpContext();
			}),
			setupRobloxTabRouter(output),
			vscode.commands.registerCommand('lupa.refresh', refreshActiveDump),
			vscode.commands.registerCommand('lupa.copyDump', async () => {
				const document = vscode.window.activeTextEditor?.document;
				if (!document || !isLupaUri(document.uri)) {
					void vscode.window.showWarningMessage('No Lupa dump is open to copy.');
					return;
				}

				await vscode.env.clipboard.writeText(document.getText());
				void vscode.window.showInformationMessage('Lupa dump copied to clipboard.');
			}),
			vscode.commands.registerCommand('lupa.openWith', async (uri?: vscode.Uri) => {
				const target = uri ?? vscode.window.activeTextEditor?.document.uri;
				if (!target) {
					void vscode.window.showWarningMessage('No Roblox file selected to open.');
					return;
				}

				const fileUri = isLupaUri(target) ? target.with({ scheme: 'file' }) : target;
				if (!isRobloxFile(fileUri)) {
					void vscode.window.showWarningMessage('The selected file is not a Roblox place or model.');
					return;
				}

				await openLupaDocument(fileUri, output);
			}),
			vscode.commands.registerCommand('lupa.openGitChanges', (uri?: vscode.Uri) => openGitChanges(uri, output)),
			vscode.commands.registerCommand('lupa.selectForCompare', (uri?: vscode.Uri) => selectForCompare(uri)),
			vscode.commands.registerCommand('lupa.compareWithSelected', (uri?: vscode.Uri) =>
				compareWithSelected(uri, output),
			),
			vscode.commands.registerCommand('lupa.compareWith', (uri?: vscode.Uri) => compareWith(uri, output)),
			vscode.commands.registerCommand('lupa.compareActiveWith', () => compareActiveWith(output)),
		);

		updateActiveDumpContext();
		output.appendLine('Lupa extension activated.');
		output.appendLine('Ready. Open a .rbxm file or run "Lupa: Open with Lupa Editor".');

		void setupGitDiffSupport(output).catch((error: unknown) => {
			const message = error instanceof Error ? error.message : String(error);
			output.appendLine(`Git setup failed: ${message}`);
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		output.appendLine(`Activation failed: ${message}`);
		void vscode.window.showErrorMessage(`Lupa extension failed to activate: ${message}`);
		throw error;
	}
}

export function deactivate() {}
