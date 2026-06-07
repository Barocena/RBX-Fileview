import * as vscode from 'vscode';
import { fromLupaUri, isLupaUri } from './lupaUri';

function shouldAutoRevealInExplorer(): boolean {
	const setting = vscode.workspace.getConfiguration('explorer').get<boolean | string>('autoReveal', true);
	return setting !== false;
}

export async function revealLupaSourceInExplorer(uri: vscode.Uri | undefined): Promise<void> {
	if (!uri || !isLupaUri(uri) || !shouldAutoRevealInExplorer()) {
		return;
	}

	const sourceUri = fromLupaUri(uri);
	await vscode.commands.executeCommand('revealInExplorer', sourceUri);
}
