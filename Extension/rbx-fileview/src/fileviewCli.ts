import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import { isBundledCliEnabled, resolveBundledCliPath } from './bundledCli';

const execFileAsync = promisify(execFile);
const CLI_EXECUTABLE = process.platform === 'win32' ? 'rbx-fileview.exe' : 'rbx-fileview';
const DEFAULT_CLI_ON_PATH = 'rbx-fileview';

let extensionContext: vscode.ExtensionContext | undefined;
let managedCliPath: string | undefined;

export function setExtensionContext(context: vscode.ExtensionContext): void {
	extensionContext = context;
}

export function setManagedCliPath(cliPath: string | undefined): void {
	managedCliPath = cliPath;
}

async function resolveManagedCliPath(): Promise<string | undefined> {
	if (!isBundledCliEnabled()) {
		return undefined;
	}

	if (managedCliPath && (await fileExists(managedCliPath))) {
		return managedCliPath;
	}

	if (!extensionContext) {
		return undefined;
	}

	const resolved = await resolveBundledCliPath(extensionContext);
	if (resolved) {
		managedCliPath = resolved;
	}

	return resolved;
}

export interface DumpResult {
	stdout: string;
	stderr: string;
}

export const DEFAULT_EXCLUDED_PROPERTIES: string[] = [];

export interface DumpOptions {
	maxDepth?: number;
	includeProperties?: boolean;
	excludedProperties?: string[];
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

export async function resolveCliPath(filePath?: string): Promise<string> {
	const config = vscode.workspace.getConfiguration('rbx-fileview');
	const configured = config.get<string>('cliPath', '').trim();

	if (!usesDefaultCliResolution(configured)) {
		return configured;
	}

	const bundled = await resolveManagedCliPath();
	if (bundled) {
		return bundled;
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

	return CLI_EXECUTABLE;
}

export function buildDumpArgs(filePath: string, options: DumpOptions = {}): string[] {
	const config = vscode.workspace.getConfiguration('rbx-fileview');
	const maxDepth = options.maxDepth ?? config.get<number | null>('maxDepth', null);
	const full = options.full ?? config.get<boolean>('includeDefaultProperties', false);
	const includeProperties = options.includeProperties ?? true;
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
				`rbx-fileview CLI not found at "${cliPath}". ` +
					'Install rbx-fileview on PATH, place rbx-fileview.exe in the workspace root, or set "rbx-fileview.cliPath".',
			);
		}

		const stderr = execError.stderr?.trim();
		const stdout = execError.stdout?.trim();
		const message = stderr || stdout || execError.message || 'Unknown error while running rbx-fileview dump';

		throw new Error(message);
	}
}
