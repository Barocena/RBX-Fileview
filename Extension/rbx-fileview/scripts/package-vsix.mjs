import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const packagePath = path.join(process.cwd(), 'package.json');
const backupPath = path.join(os.tmpdir(), `rbx-fileview-package-${process.pid}.json`);

const STRIP_KEYS = ['devDependencies', 'scripts', 'packageManager', 'vsce'];

const LOCAL_ARTIFACTS = [
	'package.json.publish-backup',
	'rbx-fileview.zip',
	'rbx-fileview-test.vsix',
	'.vsix-inspect',
];

function stripPackageJson() {
	const original = fs.readFileSync(packagePath, 'utf8');
	fs.writeFileSync(backupPath, original);

	const pkg = JSON.parse(original);
	for (const key of STRIP_KEYS) {
		delete pkg[key];
	}

	fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
}

function restorePackageJson() {
	if (!fs.existsSync(backupPath)) {
		return;
	}

	fs.copyFileSync(backupPath, packagePath);
	fs.rmSync(backupPath, { force: true });
}

function cleanupLocalArtifacts() {
	for (const artifact of LOCAL_ARTIFACTS) {
		fs.rmSync(path.join(process.cwd(), artifact), { recursive: true, force: true });
	}
}

function main() {
	cleanupLocalArtifacts();
	execSync('pnpm run compile', { stdio: 'inherit' });

	try {
		stripPackageJson();
		execSync('pnpm exec vsce package --no-dependencies --no-rewrite-relative-links -o rbx-fileview.vsix', { stdio: 'inherit' });
	} finally {
		restorePackageJson();
		cleanupLocalArtifacts();
	}
}

main();
