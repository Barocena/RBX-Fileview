import * as vscode from 'vscode';
import { isActiveDiffTab } from './diffGuard';
import { fromFileviewUri, isFileviewUri } from './fileviewUri';
import { wasScmOriginatedOpen } from './scmOpenContext';

function shouldAutoRevealInExplorer(): boolean {
	const setting = vscode.workspace.getConfiguration('explorer').get<boolean | string>('autoReveal', true);
	return setting !== false;
}

export async function revealFileviewSourceInExplorer(uri: vscode.Uri | undefined): Promise<void> {
	if (
		!uri ||
		!isFileviewUri(uri) ||
		!shouldAutoRevealInExplorer() ||
		isActiveDiffTab() ||
		wasScmOriginatedOpen(uri)
	) {
		return;
	}
	const sourceUri = fromFileviewUri(uri);
	await vscode.commands.executeCommand('revealInExplorer', sourceUri);
}
