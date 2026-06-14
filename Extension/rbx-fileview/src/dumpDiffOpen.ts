import * as vscode from 'vscode';
import { beginDiffOperation, endDiffOperation } from './diffGuard';
import { withOptionalDumpProgress } from './dumpCacheKey';
import type { DumpResult } from './fileviewCli';
import { dumpNeedsSpill } from './dumpLimits';
import { resolveDumpOpenUri } from './dumpOpen';

type DumpDiffSide = {
	fileUri: vscode.Uri;
	suffix: string;
	query?: URLSearchParams;
	virtualUri: vscode.Uri;
};

export async function openDumpDiff(options: {
	title: string;
	progressTitle: string;
	progressFiles: vscode.Uri[];
	dump: () => Promise<[DumpResult, DumpResult]>;
	left: DumpDiffSide;
	right: DumpDiffSide;
	viewColumn?: vscode.ViewColumn;
	output?: vscode.OutputChannel;
}): Promise<void> {
	const { title, progressTitle, progressFiles, dump, left, right, viewColumn, output } = options;

	beginDiffOperation();
	try {
		const [leftResult, rightResult] = await withOptionalDumpProgress(progressTitle, progressFiles, dump);

		const useSpill = dumpNeedsSpill(leftResult) || dumpNeedsSpill(rightResult);
		if (useSpill) {
			const leftUri = await resolveDumpOpenUri(left.fileUri, left.suffix, leftResult, left.query);
			const rightUri = await resolveDumpOpenUri(right.fileUri, right.suffix, rightResult, right.query);
			output?.appendLine(`Opening diff from spilled dumps: ${leftUri.fsPath} | ${rightUri.fsPath}`);
			await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title, {
				preview: false,
				viewColumn,
			});
			return;
		}

		output?.appendLine(`Opening diff: ${left.virtualUri.toString()} | ${right.virtualUri.toString()}`);
		await vscode.commands.executeCommand('vscode.diff', left.virtualUri, right.virtualUri, title, {
			preview: false,
			viewColumn,
		});
	} finally {
		endDiffOperation();
	}
}
