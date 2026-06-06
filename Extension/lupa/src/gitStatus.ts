import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { normalizeRobloxFileUri } from './lupaUri';

const execFileAsync = promisify(execFile);

export async function robloxFileHasGitChanges(fileUri: vscode.Uri): Promise<boolean> {
	const normalized = normalizeRobloxFileUri(fileUri);

	try {
		const folder = path.dirname(normalized.fsPath);
		const { stdout: gitRoot } = await execFileAsync('git', ['rev-parse', '--show-toplevel'], {
			cwd: folder,
			windowsHide: true,
		});
		const relative = path.relative(gitRoot.trim(), normalized.fsPath).split(path.sep).join('/');
		const { stdout } = await execFileAsync('git', ['status', '--porcelain', '--', relative], {
			cwd: gitRoot.trim(),
			windowsHide: true,
		});
		return stdout.trim().length > 0;
	} catch {
		return false;
	}
}
