import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { dumpRobloxFile, type DumpResult } from './fileviewCli';

const execFileAsync = promisify(execFile);

export type GitRef = 'HEAD' | 'WORKTREE' | 'INDEX' | (string & {});

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

function gitShowRefSpec(ref: GitRef, relativePath: string): string {
	if (ref === 'INDEX') {
		return `:${relativePath}`;
	}

	return `${ref}:${relativePath}`;
}

async function writeGitBlobToTemp(repoRoot: string, ref: GitRef, relativePath: string): Promise<string> {
	const { stdout } = await execFileAsync('git', ['show', gitShowRefSpec(ref, relativePath)], {
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

function spillSuffixForRef(ref: GitRef): string {
	if (ref === 'WORKTREE') {
		return 'worktree';
	}

	if (ref === 'HEAD') {
		return 'head';
	}

	if (ref === 'INDEX') {
		return 'index';
	}

	return ref.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 24);
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
		return await dumpRobloxFile(tempFile, {
			spillLabelPath: filePath,
			spillSuffix: spillSuffixForRef(ref),
		});
	} finally {
		await fs.rm(path.dirname(tempFile), { recursive: true, force: true }).catch(() => undefined);
	}
}
