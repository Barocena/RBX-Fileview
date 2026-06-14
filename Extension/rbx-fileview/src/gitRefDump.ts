import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { dumpRobloxFile, type DumpResult } from './fileviewCli';

const execFileAsync = promisify(execFile);

export type GitRef = 'HEAD' | 'WORKTREE';

async function findRepoRoot(filePath: string): Promise<string | undefined> {
	let directory = path.dirname(filePath);

	for (let depth = 0; depth < 16; depth += 1) {
		try {
			await fs.access(path.join(directory, '.git'));
			return directory;
		} catch {
			// continue walking up
		}

		const parent = path.dirname(directory);
		if (parent === directory) {
			break;
		}
		directory = parent;
	}

	return undefined;
}

async function writeGitBlobToTemp(repoRoot: string, ref: string, relativePath: string): Promise<string> {
	const { stdout } = await execFileAsync('git', ['show', `${ref}:${relativePath}`], {
		cwd: repoRoot,
		encoding: 'buffer',
		maxBuffer: 128 * 1024 * 1024,
		windowsHide: true,
	});

	const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rbx-fileview-git-'));
	const tempFile = path.join(tempDir, path.basename(relativePath));
	await fs.writeFile(tempFile, stdout);
	return tempFile;
}

export async function dumpRobloxFileAtRef(
	filePath: string,
	ref: GitRef,
): Promise<DumpResult> {
	if (ref === 'WORKTREE') {
		return dumpRobloxFile(filePath, { spillLabelPath: filePath, spillSuffix: 'worktree' });
	}

	const repoRoot = await findRepoRoot(filePath);
	if (!repoRoot) {
		throw new Error(`Could not find a git repository for "${filePath}".`);
	}

	const relativePath = path.relative(repoRoot, filePath).split(path.sep).join('/');
	const tempFile = await writeGitBlobToTemp(repoRoot, ref, relativePath);

	try {
		return await dumpRobloxFile(tempFile, { spillLabelPath: filePath, spillSuffix: 'head' });
	} finally {
		await fs.rm(path.dirname(tempFile), { recursive: true, force: true }).catch(() => undefined);
	}
}
