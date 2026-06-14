import * as vscode from 'vscode';
import type { DumpResult } from './fileviewCli';
import { dumpNeedsSpill } from './dumpLimits';
import { ensureDumpUri } from './spillRegistry';
import { toFileviewUri } from './fileviewUri';

export async function resolveDumpOpenUri(
	fileUri: vscode.Uri,
	suffix: string,
	result: DumpResult,
	query?: URLSearchParams,
): Promise<vscode.Uri> {
	if (result.spillPath) {
		return vscode.Uri.file(result.spillPath);
	}

	if (dumpNeedsSpill(result)) {
		return ensureDumpUri(fileUri.fsPath, suffix, result);
	}

	let uri = toFileviewUri(fileUri);
	if (query) {
		uri = uri.with({ query: query.toString() });
	}

	return uri;
}
