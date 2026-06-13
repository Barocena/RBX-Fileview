import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { clearUserEditorAssociations, clearWorkspaceEditorAssociations } from './editorAssociations';
import { errorMessage } from './errorMessage';
import { resolveCliPath } from './fileviewCli';

const execFileAsync = promisify(execFile);

const GIT_ATTRIBUTES_MARKER = '# rbx-fileview: diff Roblox files as YAML text dumps';
const GIT_ATTRIBUTES_LINES = [
	GIT_ATTRIBUTES_MARKER,
	'*.rbxl diff=rbx-fileview',
	'*.rbxlx diff=rbx-fileview',
	'*.rbxm diff=rbx-fileview',
	'*.rbxmx diff=rbx-fileview',
	'',
];

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
	const wrapperPath = path.join(folderPath, 'scripts', 'rbx-fileview-textconv.cmd');

	try {
		await fs.access(wrapperPath);
		return wrapperPath.split(path.sep).join('/');
	} catch {
		// Fall back to the CLI directly.
	}

	if (process.platform === 'win32') {
		return `${cliPath.split(path.sep).join('/')} dump`;
	}

	return `${cliPath} dump`;
}

async function ensureGitAttributes(gitRoot: string, output: vscode.OutputChannel): Promise<void> {
	const infoDir = path.join(gitRoot, '.git', 'info');
	const attributesPath = path.join(infoDir, 'attributes');
	let contents = '';

	try {
		contents = await fs.readFile(attributesPath, 'utf8');
	} catch {
		contents = '';
	}

	if (contents.includes('diff=rbx-fileview')) {
		output.appendLine(`.git/info/attributes already has diff=rbx-fileview (${attributesPath})`);
		return;
	}

	await fs.mkdir(infoDir, { recursive: true });

	const prefix = contents.length > 0 && !contents.endsWith('\n') ? '\n' : '';
	const updated = `${contents}${prefix}${GIT_ATTRIBUTES_LINES.join('\n')}`;
	await fs.writeFile(attributesPath, updated, 'utf8');
	output.appendLine(`Updated ${attributesPath} with RBX-Fileview diff driver attributes.`);
}

async function ensureGitConfig(gitRoot: string, textconv: string, output: vscode.OutputChannel): Promise<void> {
	const current = await runGit(['config', '--local', '--get', 'diff.rbx-fileview.textconv'], gitRoot).catch(() => '');

	if (current === textconv) {
		output.appendLine(`git diff.rbx-fileview.textconv already set (${textconv})`);
		return;
	}

	await runGit(['config', '--local', 'diff.rbx-fileview.textconv', textconv], gitRoot);
	await runGit(['config', '--local', 'diff.rbx-fileview.binary', 'false'], gitRoot);
	await runGit(['config', '--local', 'diff.rbx-fileview.cachetextconv', 'true'], gitRoot);
	output.appendLine(`Configured git diff driver "rbx-fileview" -> ${textconv}`);
}

export async function setupGitDiffSupport(output: vscode.OutputChannel): Promise<void> {
	const config = vscode.workspace.getConfiguration('rbx-fileview');
	if (!config.get<boolean>('setupGitConfig', true)) {
		output.appendLine('Git config setup disabled (rbx-fileview.setupGitConfig = false).');
		return;
	}

	await clearUserEditorAssociations(output);
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

			await ensureGitAttributes(gitRoot, output);
			await ensureGitConfig(gitRoot, textconv, output);
		} catch (error) {
			output.appendLine(`Failed to configure git diff support for ${gitRoot}: ${errorMessage(error)}`);
		}
	}
}
