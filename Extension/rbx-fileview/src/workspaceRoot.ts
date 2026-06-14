import * as vscode from 'vscode';

export function resolveWorkspaceRoot(filePath?: string): string | undefined {
	if (filePath) {
		const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(filePath));
		if (folder) {
			return folder.uri.fsPath;
		}
	}

	return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}
