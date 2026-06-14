import * as vscode from 'vscode';
import { isActiveDiffTab } from './diffGuard';
import { fromFileviewUri, isFileviewUri } from './fileviewUri';
import { wasScmOriginatedOpen } from './scmOpenContext';
import { findSourceUriForSpillPath, isSpillDumpUri } from './spillRegistry';

function shouldAutoRevealInExplorer(): boolean {
	const setting = vscode.workspace.getConfiguration('explorer').get<boolean | string>('autoReveal', true);
	return setting !== false;
}

export async function revealFileviewSourceInExplorer(uri: vscode.Uri | undefined): Promise<void> {
	if (!uri || !shouldAutoRevealInExplorer() || isActiveDiffTab() || wasScmOriginatedOpen(uri)) {
		return;
	}

	let sourceUri: vscode.Uri | undefined;
	if (isFileviewUri(uri)) {
		sourceUri = fromFileviewUri(uri);
	} else if (isSpillDumpUri(uri)) {
		sourceUri = findSourceUriForSpillPath(uri.fsPath);
	}

	if (!sourceUri) {
		return;
	}

	await vscode.commands.executeCommand('revealInExplorer', sourceUri);
}
