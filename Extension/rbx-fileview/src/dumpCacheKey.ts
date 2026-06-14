import * as vscode from 'vscode';
import type { GitRef } from './gitRefDump';

export const DUMP_PROGRESS_SOURCE_BYTES = 8 * 1024 * 1024;

export function buildDumpCacheKey(filePath: string, ref: GitRef, mtimeMs: number | undefined): string {
	const config = vscode.workspace.getConfiguration('rbx-fileview', vscode.Uri.file(filePath));
	return [
		filePath,
		ref,
		String(mtimeMs ?? 0),
		String(config.get<boolean>('includeProperties', true)),
		String(config.get<boolean>('includeDefaultProperties', false)),
		String(config.get<number | null>('maxDepth', null)),
		JSON.stringify(config.get<string[]>('excludedProperties', [])),
	].join('\0');
}

export async function shouldShowDumpProgress(fileUri: vscode.Uri): Promise<boolean> {
	try {
		const stat = await vscode.workspace.fs.stat(fileUri);
		return stat.size >= DUMP_PROGRESS_SOURCE_BYTES;
	} catch {
		return false;
	}
}

export async function shouldShowDumpProgressForFiles(fileUris: vscode.Uri[]): Promise<boolean> {
	for (const fileUri of fileUris) {
		if (await shouldShowDumpProgress(fileUri)) {
			return true;
		}
	}

	return false;
}

export async function withOptionalDumpProgress<T>(
	title: string,
	fileUris: vscode.Uri[],
	task: () => Promise<T>,
): Promise<T> {
	if (!(await shouldShowDumpProgressForFiles(fileUris))) {
		return task();
	}

	return vscode.window.withProgress(
		{
			location: vscode.ProgressLocation.Notification,
			title,
			cancellable: false,
		},
		task,
	);
}
