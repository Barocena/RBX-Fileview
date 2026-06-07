import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

export interface DumpResult {
	stdout: string;
	stderr: string;
}

export interface DumpOptions {
	maxDepth?: number;
	includeProperties?: boolean;
	full?: boolean;
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
	const executableName = process.platform === 'win32' ? 'lupa.exe' : 'lupa';

	for (const folder of vscode.workspace.workspaceFolders ?? []) {
		const candidate = path.join(folder.uri.fsPath, executableName);
		if (await fileExists(candidate)) {
			return candidate;
		}
	}

	return undefined;
}

async function findCliNearFile(filePath: string): Promise<string | undefined> {
	const executableName = process.platform === 'win32' ? 'lupa.exe' : 'lupa';
	let directory = path.dirname(filePath);

	for (let depth = 0; depth < 8; depth += 1) {
		const candidate = path.join(directory, executableName);
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

export async function resolveCliPath(filePath?: string): Promise<string> {
	const config = vscode.workspace.getConfiguration('lupa');
	const configured = config.get<string>('cliPath', 'lupa').trim();

	if (configured !== 'lupa' && configured !== 'lupa.exe') {
		return configured;
	}

	if (filePath) {
		const nearFile = await findCliNearFile(filePath);
		if (nearFile) {
			return nearFile;
		}
	}

	const inWorkspace = await findWorkspaceCli();
	if (inWorkspace) {
		return inWorkspace;
	}

	return configured;
}

export function buildDumpArgs(filePath: string, options: DumpOptions = {}): string[] {
	const config = vscode.workspace.getConfiguration('lupa');
	const maxDepth = options.maxDepth ?? config.get<number | null>('maxDepth', null);
	const full = options.full ?? config.get<boolean>('includeFullProperties', false);
	const includeProperties = options.includeProperties ?? true;

	const args = ['dump', filePath];

	if (maxDepth !== null && maxDepth !== undefined && !Number.isNaN(maxDepth)) {
		args.push('--max-depth', String(maxDepth));
	}

	if (full) {
		args.push('--full');
	}

	if (!includeProperties) {
		args.push('--no-properties');
	}

	return args;
}

export async function dumpRobloxFile(
	filePath: string,
	options: DumpOptions = {},
): Promise<DumpResult> {
	const cliPath = await resolveCliPath(filePath);
	const args = buildDumpArgs(filePath, options);

	try {
		const { stdout, stderr } = await execFileAsync(cliPath, args, {
			encoding: 'utf8',
			maxBuffer: 64 * 1024 * 1024,
			windowsHide: true,
		});

		return {
			stdout: stdout.trimEnd(),
			stderr: stderr.trim(),
		};
	} catch (error) {
		const execError = error as NodeJS.ErrnoException & {
			stdout?: string;
			stderr?: string;
			code?: number | string;
		};

		if (execError.code === 'ENOENT') {
			throw new Error(
				`Lupa CLI not found at "${cliPath}". ` +
					'Build lupa.exe in the project root or set "lupa.cliPath" in settings.',
			);
		}

		const stderr = execError.stderr?.trim();
		const stdout = execError.stdout?.trim();
		const message = stderr || stdout || execError.message || 'Unknown error while running lupa dump';

		throw new Error(message);
	}
}
