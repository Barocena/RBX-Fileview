import * as vscode from 'vscode';

const ROBOX_PATTERNS = ['*.rbxl', '*.rbxlx', '*.rbxm', '*.rbxmx'] as const;
const LUPA_VIEW_TYPE = 'lupa.roblox';

export async function clearWorkspaceEditorAssociations(output: vscode.OutputChannel): Promise<void> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return;
	}

	const workbench = vscode.workspace.getConfiguration('workbench', folder.uri);
	const current = workbench.get<Record<string, string>>('editorAssociations') ?? {};
	const cleaned = { ...current };
	let changed = false;

	for (const pattern of ROBOX_PATTERNS) {
		if (cleaned[pattern] === LUPA_VIEW_TYPE) {
			delete cleaned[pattern];
			changed = true;
		}
	}

	if (!changed) {
		output.appendLine('Workspace editorAssociations do not map Roblox files to Lupa.');
		return;
	}

	try {
		await workbench.update('editorAssociations', cleaned, vscode.ConfigurationTarget.Workspace);
		output.appendLine('Cleared workspace editorAssociations for Roblox files (keeps git SCM diffs working).');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		output.appendLine(`Could not clear workspace editorAssociations: ${message}`);
	}
}

export async function setWorkspaceEditorAssociations(output: vscode.OutputChannel): Promise<void> {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return;
	}

	const workbench = vscode.workspace.getConfiguration('workbench', folder.uri);
	const current = workbench.get<Record<string, string>>('editorAssociations') ?? {};
	const updated = { ...current };
	let changed = false;

	for (const pattern of ROBOX_PATTERNS) {
		if (updated[pattern] !== LUPA_VIEW_TYPE) {
			updated[pattern] = LUPA_VIEW_TYPE;
			changed = true;
		}
	}

	if (!changed) {
		return;
	}

	try {
		await workbench.update('editorAssociations', updated, vscode.ConfigurationTarget.Workspace);
		output.appendLine('Set workspace editorAssociations for Roblox files -> Lupa.');
		output.appendLine('Warning: SCM click diffs may break. Use "Lupa: Open Git Changes" instead.');
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		output.appendLine(`Could not set workspace editorAssociations: ${message}`);
	}
}
