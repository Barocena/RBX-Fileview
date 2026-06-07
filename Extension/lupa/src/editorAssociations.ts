import * as vscode from 'vscode';

export const ROBOX_PATTERNS = ['*.rbxl', '*.rbxlx', '*.rbxm', '*.rbxmx'] as const;
export const LUPA_VIEW_TYPE = 'lupa.roblox';

const DEFAULT_DIFF_ASSOCIATIONS: Record<string, string> = {
	'*.rbxl': 'default',
	'*.rbxlx': 'default',
	'*.rbxm': 'default',
	'*.rbxmx': 'default',
};

function mergeAssociations(
	current: Record<string, string>,
	updates: Record<string, string>,
): { merged: Record<string, string>; changed: boolean } {
	const merged = { ...current };
	let changed = false;

	for (const [pattern, viewType] of Object.entries(updates)) {
		if (merged[pattern] !== viewType) {
			merged[pattern] = viewType;
			changed = true;
		}
	}

	return { merged, changed };
}

function stripRobloxEditorAssociations(current: Record<string, string>): {
	merged: Record<string, string>;
	changed: boolean;
} {
	const merged = { ...current };
	let changed = false;

	for (const pattern of ROBOX_PATTERNS) {
		if (merged[pattern] === LUPA_VIEW_TYPE) {
			delete merged[pattern];
			changed = true;
		}
	}

	return { merged, changed };
}

async function updateWorkbenchAssociations(
	label: string,
	target: vscode.ConfigurationTarget,
	resource: vscode.Uri | undefined,
	diffUpdates: Record<string, string>,
	output: vscode.OutputChannel,
): Promise<void> {
	const workbench = vscode.workspace.getConfiguration('workbench', resource);
	const currentEditor = workbench.get<Record<string, string>>('editorAssociations') ?? {};
	const currentDiff = workbench.get<Record<string, string>>('diffEditorAssociations') ?? {};

	const stripped = stripRobloxEditorAssociations(currentEditor);
	const diff = mergeAssociations(currentDiff, diffUpdates);

	if (!stripped.changed && !diff.changed) {
		return;
	}

	try {
		if (stripped.changed) {
			await workbench.update('editorAssociations', stripped.merged, target);
			output.appendLine(`Cleared Roblox -> Lupa editor associations in ${label} settings.`);
		}
		if (diff.changed) {
			await workbench.update('diffEditorAssociations', diff.merged, target);
			output.appendLine(`Updated ${label} diff editor associations for Roblox files.`);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		output.appendLine(`Could not update ${label} editor associations: ${message}`);
	}
}

export async function syncRobloxEditorAssociations(output: vscode.OutputChannel): Promise<void> {
	await updateWorkbenchAssociations(
		'User',
		vscode.ConfigurationTarget.Global,
		undefined,
		DEFAULT_DIFF_ASSOCIATIONS,
		output,
	);

	await updateWorkbenchAssociations(
		'Workspace',
		vscode.ConfigurationTarget.Workspace,
		vscode.workspace.workspaceFolders?.[0]?.uri,
		DEFAULT_DIFF_ASSOCIATIONS,
		output,
	);
}
