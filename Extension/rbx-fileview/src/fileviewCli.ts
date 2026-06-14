import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { resolveWorkspaceRoot } from './workspaceRoot';
import { isLargeDump } from './dumpLimits';
import { resolveSpillPath } from './spillRegistry';

const execFileAsync = promisify(execFile);
const CLI_EXECUTABLE = process.platform === 'win32' ? 'rbx-fileview.exe' : 'rbx-fileview';
const DEFAULT_CLI_ON_PATH = 'rbx-fileview';
const STDERR_MAX_BUFFER = 16 * 1024 * 1024;

export interface DumpResult {
	stdout: string;
	stderr: string;
	byteLength: number;
	spillPath?: string;
}

export const DEFAULT_EXCLUDED_PROPERTIES: string[] = [];

export interface DumpOptions {
	maxDepth?: number;
	includeProperties?: boolean;
	excludedProperties?: string[];
	full?: boolean;
	spillLabelPath?: string;
	spillSuffix?: string;
}

export interface CliAvailability {
	available: boolean;
	resolvedPath: string;
}

export interface CliExecutionTarget {
	cliPath: string;
	cwd?: string;
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function findWorkspaceCli(): Promise<string | undefined> {
	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		const candidate = path.join(folder.uri.fsPath, CLI_EXECUTABLE);
		if (await fileExists(candidate)) {
			return candidate;
		}
	}

	return undefined;
}

async function findCliNearFile(filePath: string): Promise<string | undefined> {
	let directory = path.dirname(filePath);

	for (let depth = 0; depth < 8; depth += 1) {
		const candidate = path.join(directory, CLI_EXECUTABLE);
		if (await fileExists(candidate)) {
			return candidate;
		}

		const parent = path.dirname(directory);
		if (parent === directory) {
			break;
		}
		directory = parent;
	}

	return undefined;
}

function usesDefaultCliResolution(configured: string): boolean {
	if (configured.length === 0) {
		return true;
	}

	return configured === DEFAULT_CLI_ON_PATH || configured === `${DEFAULT_CLI_ON_PATH}.exe`;
}

function isExplicitCliPath(cliPath: string): boolean {
	return path.isAbsolute(cliPath) || cliPath.includes(path.sep) || cliPath.includes('/');
}

function formatExecError(error: NodeJS.ErrnoException & { stdout?: string; stderr?: string }): string {
	const stderr = error.stderr?.trim();
	if (stderr) {
		return stderr;
	}

	const stdout = error.stdout?.trim();
	if (stdout && stdout.length <= 4096) {
		return stdout;
	}

	if (stdout && stdout.length > 4096) {
		return `${error.message ?? 'rbx-fileview dump failed'} (dump output was too large to include in the error message)`;
	}

	return error.message || 'Unknown error while running rbx-fileview dump';
}

export async function resolveCliExecutionTarget(filePath?: string): Promise<CliExecutionTarget> {
	const config = vscode.workspace.getConfiguration('rbx-fileview');
	const configured = config.get<string>('cliPath', '').trim();
	const workspaceRoot = resolveWorkspaceRoot(filePath);

	if (!usesDefaultCliResolution(configured)) {
		return {
			cliPath: configured,
			cwd: workspaceRoot,
		};
	}

	if (filePath) {
		const nearFile = await findCliNearFile(filePath);
		if (nearFile) {
			return { cliPath: nearFile, cwd: workspaceRoot };
		}
	}

	const inWorkspace = await findWorkspaceCli();
	if (inWorkspace) {
		return { cliPath: inWorkspace, cwd: workspaceRoot };
	}

	return {
		cliPath: CLI_EXECUTABLE,
		cwd: workspaceRoot,
	};
}

export async function resolveCliPath(filePath?: string): Promise<string> {
	const target = await resolveCliExecutionTarget(filePath);
	return target.cliPath;
}

export async function checkCliAvailability(filePath?: string): Promise<CliAvailability> {
	const target = await resolveCliExecutionTarget(filePath);

	if (isExplicitCliPath(target.cliPath)) {
		return {
			available: await fileExists(target.cliPath),
			resolvedPath: target.cliPath,
		};
	}

	try {
		await execFileAsync(target.cliPath, ['--version'], {
			encoding: 'utf8',
			timeout: 5000,
			windowsHide: true,
			cwd: target.cwd,
		});

		return {
			available: true,
			resolvedPath: target.cliPath,
		};
	} catch (error) {
		const execError = error as NodeJS.ErrnoException;

		if (execError.code === 'ENOENT') {
			return {
				available: false,
				resolvedPath: target.cliPath,
			};
		}

		return {
			available: true,
			resolvedPath: target.cliPath,
		};
	}
}

export async function notifyIfCliMissing(output: vscode.OutputChannel, filePath?: string): Promise<void> {
	const { available, resolvedPath } = await checkCliAvailability(filePath);

	if (available) {
		output.appendLine(`rbx-fileview CLI: ${resolvedPath}`);
		return;
	}

	output.appendLine(`rbx-fileview CLI not found (looked for: ${resolvedPath})`);

	const selection = await vscode.window.showWarningMessage(
		'RBX-Fileview: rbx-fileview CLI not found. Install it for this project or set rbx-fileview.cliPath in settings.',
		'Open Settings',
	);

	if (selection === 'Open Settings') {
		await vscode.commands.executeCommand('workbench.action.openSettings', 'rbx-fileview.cliPath');
	}
}

export function buildDumpArgs(filePath: string, options: DumpOptions = {}): string[] {
	const config = vscode.workspace.getConfiguration('rbx-fileview', vscode.Uri.file(filePath));
	const maxDepth = options.maxDepth ?? config.get<number | null>('maxDepth', null);
	const full = options.full ?? config.get<boolean>('includeDefaultProperties', false);
	const includeProperties = options.includeProperties ?? config.get<boolean>('includeProperties', true);
	const excludedProperties =
		options.excludedProperties ?? config.get<string[]>('excludedProperties', DEFAULT_EXCLUDED_PROPERTIES);

	const args = ['dump', filePath];

	if (maxDepth !== null && maxDepth !== undefined && !Number.isNaN(maxDepth)) {
		args.push('--max-depth', String(maxDepth));
	}

	if (full) {
		args.push('--include-default-properties');
	}

	if (!includeProperties) {
		args.push('--no-properties');
	}

	if (excludedProperties.length > 0) {
		const names = excludedProperties.map((name) => name.trim()).filter((name) => name.length > 0);
		if (names.length > 0) {
			args.push('--exclude-property', names.join(','));
		}
	}

	return args;
}

export async function dumpRobloxFile(
	filePath: string,
	options: DumpOptions = {},
): Promise<DumpResult> {
	const target = await resolveCliExecutionTarget(filePath);
	const tempFile = path.join(os.tmpdir(), `rbx-fileview-${randomUUID()}.yaml`);
	const args = [...buildDumpArgs(filePath, options), '-o', tempFile];
	let spillPath: string | undefined;

	try {
		const { stderr } = await execFileAsync(target.cliPath, args, {
			encoding: 'utf8',
			maxBuffer: STDERR_MAX_BUFFER,
			windowsHide: true,
			cwd: target.cwd,
		});

		const stat = await fs.stat(tempFile);
		if (isLargeDump(stat.size)) {
			spillPath = await resolveSpillPath(
				options.spillLabelPath ?? filePath,
				options.spillSuffix ?? 'worktree',
			);
			await fs.rename(tempFile, spillPath);
			return {
				stdout: '',
				stderr: stderr.trim(),
				byteLength: stat.size,
				spillPath,
			};
		}

		const stdout = await fs.readFile(tempFile, 'utf8');

		return {
			stdout: stdout.trimEnd(),
			stderr: stderr.trim(),
			byteLength: stat.size,
		};
	} catch (error) {
		const execError = error as NodeJS.ErrnoException & {
			stdout?: string;
			stderr?: string;
			code?: number | string;
		};

		if (execError.code === 'ENOENT') {
			throw new Error(
				`rbx-fileview CLI not found at "${target.cliPath}". ` +
					'Install rbx-fileview for this project, add it on PATH, place rbx-fileview.exe in the workspace root, or set "rbx-fileview.cliPath".',
			);
		}

		throw new Error(formatExecError(execError));
	} finally {
		if (!spillPath) {
			await fs.rm(tempFile, { force: true }).catch(() => undefined);
		}
	}
}
