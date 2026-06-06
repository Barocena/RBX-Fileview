import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { clearWorkspaceEditorAssociations } from './editorAssociations';
import { resolveCliPath } from './lupaCli';

const execFileAsync = promisify(execFile);

const GIT_ATTRIBUTES_MARKER = '# Lupa: diff Roblox files as YAML text dumps';
const GIT_ATTRIBUTES_LINES = [
	GIT_ATTRIBUTES_MARKER,
	'*.rbxl diff=lupa',
	'*.rbxlx diff=lupa',
	'*.rbxm diff=lupa',
	'*.rbxmx diff=lupa',
	'',
];

const ROBOX_PATTERNS = ['*.rbxl', '*.rbxlx', '*.rbxm', '*.rbxmx'] as const;
const LUPA_VIEW_TYPE = 'lupa.roblox';

async function runGit(args: string[], cwd: string): Promise<string> {
	const { stdout } = await execFileAsync('git', args, {
		cwd,
		windowsHide: true,
	});
	return stdout.trim();
}

async function findGitRoot(folderPath: string): Promise<string | undefined> {
	try {
		return await runGit(['rev-parse', '--show-toplevel'], folderPath);
	} catch {
		return undefined;
	}
}

async function resolveTextconvCommand(folderPath: string, cliPath: string): Promise<string> {
	const wrapperCandidates = [
		path.join(folderPath, 'scripts', 'lupa-textconv.cmd'),
		path.join(folderPath, 'scripts', 'lupa-textconv.ps1'),
	];

	for (const candidate of wrapperCandidates) {
		try {
			await fs.access(candidate);
			return candidate.split(path.sep).join('/');
		} catch {
			// try next candidate
		}
	}

	if (process.platform === 'win32') {
		return `${cliPath.split(path.sep).join('/')} dump`;
	}

	return `${cliPath} dump`;
}

async function ensureGitAttributes(folderPath: string, output: vscode.OutputChannel): Promise<void> {
	const attributesPath = path.join(folderPath, '.gitattributes');
	let contents = '';

	try {
		contents = await fs.readFile(attributesPath, 'utf8');
	} catch {
		contents = '';
	}

	if (contents.includes('diff=lupa')) {
		output.appendLine(`.gitattributes already has diff=lupa (${attributesPath})`);
		return;
	}

	const prefix = contents.length > 0 && !contents.endsWith('\n') ? '\n' : '';
	const updated = `${contents}${prefix}${GIT_ATTRIBUTES_LINES.join('\n')}`;
	await fs.writeFile(attributesPath, updated, 'utf8');
	output.appendLine(`Updated ${attributesPath} with Lupa diff driver attributes.`);
}

async function ensureGitConfig(gitRoot: string, textconv: string, output: vscode.OutputChannel): Promise<void> {
	const current = await runGit(['config', '--local', '--get', 'diff.lupa.textconv'], gitRoot).catch(() => '');

	if (current === textconv) {
		output.appendLine(`git diff.lupa.textconv already set (${textconv})`);
		return;
	}

	await runGit(['config', '--local', 'diff.lupa.textconv', textconv], gitRoot);
	await runGit(['config', '--local', 'diff.lupa.binary', 'false'], gitRoot);
	await runGit(['config', '--local', 'diff.lupa.cachetextconv', 'true'], gitRoot);
	output.appendLine(`Configured git diff driver "lupa" -> ${textconv}`);
}

async function clearEditorAssociations(
	target: vscode.ConfigurationTarget,
	label: string,
	output: vscode.OutputChannel,
): Promise<void> {
	const workbench = vscode.workspace.getConfiguration('workbench');
	const current = workbench.get<Record<string, string>>('editorAssociations') ?? {};

	let editorChanged = false;
	const cleanedEditor = { ...current };

	for (const pattern of ROBOX_PATTERNS) {
		if (cleanedEditor[pattern] === LUPA_VIEW_TYPE) {
			delete cleanedEditor[pattern];
			editorChanged = true;
		}
	}

	if (!editorChanged) {
		return;
	}

	try {
		await workbench.update('editorAssociations', cleanedEditor, target);
		output.appendLine(`Removed Lupa editor associations from ${label} settings.`);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		output.appendLine(`Could not update ${label} editorAssociations: ${message}`);
	}
}

export async function setupGitDiffSupport(output: vscode.OutputChannel): Promise<void> {
	const config = vscode.workspace.getConfiguration('lupa');
	if (!config.get<boolean>('setupGitDiff', true)) {
		output.appendLine('Git diff setup disabled (lupa.setupGitDiff = false).');
		return;
	}

	await clearEditorAssociations(vscode.ConfigurationTarget.Global, 'User', output);
	await clearWorkspaceEditorAssociations(output);

	const folders = vscode.workspace.workspaceFolders ?? [];
	if (folders.length === 0) {
		output.appendLine('No workspace folder open — skipped git diff setup.');
		return;
	}

	for (const folder of folders) {
		const folderPath = folder.uri.fsPath;
		const gitRoot = await findGitRoot(folderPath);
		if (!gitRoot) {
			output.appendLine(`Not a git repository: ${folderPath}`);
			continue;
		}

		try {
			output.appendLine(`Setting up git diff in ${gitRoot}`);
			const cliPath = await resolveCliPath(folderPath);
			output.appendLine(`Using CLI: ${cliPath}`);
			const textconv = await resolveTextconvCommand(gitRoot, cliPath);

			if (config.get<boolean>('updateGitAttributes', true)) {
				await ensureGitAttributes(gitRoot, output);
			}
			await ensureGitConfig(gitRoot, textconv, output);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			output.appendLine(`Failed to configure git diff support for ${gitRoot}: ${message}`);
		}
	}
}
