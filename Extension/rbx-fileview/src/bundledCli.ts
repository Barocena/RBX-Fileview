import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';

export const BUNDLED_CLI_VERSION_KEY = 'bundledCliVersion';

/** Set to true when Marketplace allows bundled platform binaries in the VSIX. */
export const BUNDLED_CLI_ENABLED = false;

export function isBundledCliEnabled(): boolean {
	return BUNDLED_CLI_ENABLED;
}

export function getVsceTarget(): string | undefined {
	const { platform, arch } = process;

	if (platform === 'win32' && arch === 'x64') {
		return 'win32-x64';
	}

	if (platform === 'win32' && arch === 'arm64') {
		return 'win32-arm64';
	}

	if (platform === 'darwin' && arch === 'arm64') {
		return 'darwin-arm64';
	}

	if (platform === 'darwin' && arch === 'x64') {
		return 'darwin-x64';
	}

	if (platform === 'linux' && arch === 'x64') {
		return 'linux-x64';
	}

	if (platform === 'linux' && arch === 'arm64') {
		return 'linux-arm64';
	}

	return undefined;
}

export function getBundledExecutableName(): string {
	return process.platform === 'win32' ? 'rbx-fileview.exe' : 'rbx-fileview';
}

async function fileExists(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath);
		return true;
	} catch {
		return false;
	}
}

export function getBundledCliSourcePath(context: vscode.ExtensionContext): string | undefined {
	const target = getVsceTarget();
	if (!target) {
		return undefined;
	}

	return path.join(context.extensionPath, 'bin', target, getBundledExecutableName());
}

export async function ensureBundledCli(context: vscode.ExtensionContext): Promise<string | undefined> {
	if (!BUNDLED_CLI_ENABLED) {
		return undefined;
	}

	const sourcePath = getBundledCliSourcePath(context);
	if (!sourcePath || !(await fileExists(sourcePath))) {
		return undefined;
	}

	const destinationDir = path.join(context.globalStorageUri.fsPath, 'bin');
	const destinationPath = path.join(destinationDir, getBundledExecutableName());
	const extensionVersion = context.extension.packageJSON.version;
	const installedVersion = context.globalState.get<string>(BUNDLED_CLI_VERSION_KEY);

	if (installedVersion === extensionVersion && (await fileExists(destinationPath))) {
		return destinationPath;
	}

	try {
		await fs.mkdir(destinationDir, { recursive: true });
		await fs.copyFile(sourcePath, destinationPath);

		if (process.platform !== 'win32') {
			await fs.chmod(destinationPath, 0o755);
		}

		await context.globalState.update(BUNDLED_CLI_VERSION_KEY, extensionVersion);
		return destinationPath;
	} catch {
		// Fall back to running directly from the extension install directory.
		return sourcePath;
	}
}

export async function resolveBundledCliPath(context: vscode.ExtensionContext): Promise<string | undefined> {
	return ensureBundledCli(context);
}
