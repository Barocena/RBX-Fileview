import * as vscode from 'vscode';
import { errorMessage } from './errorMessage';
import { ROBLOX_GLOB_PATTERNS } from './fileviewUri';

const FILEVIEW_VIEW_TYPE = 'rbx-fileview.roblox';

function stripFileviewAssociations(
	current: Record<string, string>,
): { cleaned: Record<string, string>; changed: boolean } {
	const cleaned = { ...current };
	let changed = false;

	for (const pattern of ROBLOX_GLOB_PATTERNS) {
		if (cleaned[pattern] === FILEVIEW_VIEW_TYPE) {
			delete cleaned[pattern];
			changed = true;
		}
	}

	return { cleaned, changed };
}

export async function clearUserEditorAssociations(output: vscode.OutputChannel): Promise<void> {
	const workbench = vscode.workspace.getConfiguration('workbench');
	const { cleaned, changed } = stripFileviewAssociations(
		workbench.get<Record<string, string>>('editorAssociations') ?? {},
	);

	if (!changed) {
		return;
	}

	try {
		await workbench.update('editorAssociations', cleaned, vscode.ConfigurationTarget.Global);
		output.appendLine('Removed RBX-Fileview editor associations from User settings.');
	} catch (error) {
		output.appendLine(`Could not update User editorAssociations: ${errorMessage(error)}`);
	}
}

export async function clearWorkspaceEditorAssociations(output: vscode.OutputChannel): Promise<void> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return;
	}

	const workbench = vscode.workspace.getConfiguration('workbench', folder.uri);
	const { cleaned, changed } = stripFileviewAssociations(
		workbench.get<Record<string, string>>('editorAssociations') ?? {},
	);

	if (!changed) {
		output.appendLine('Workspace editorAssociations do not map Roblox files to rbx-fileview.');
		return;
	}

	try {
		await workbench.update('editorAssociations', cleaned, vscode.ConfigurationTarget.Workspace);
		output.appendLine('Cleared workspace editorAssociations for Roblox files (keeps git SCM diffs working).');
	} catch (error) {
		output.appendLine(`Could not clear workspace editorAssociations: ${errorMessage(error)}`);
	}
}
