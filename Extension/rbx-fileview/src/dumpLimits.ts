export const VSCODE_VIRTUAL_DOC_LIMIT_BYTES = 45 * 1024 * 1024;

export function isLargeDump(byteLength: number): boolean {
	return byteLength > VSCODE_VIRTUAL_DOC_LIMIT_BYTES;
}

export function dumpNeedsSpill(result: { spillPath?: string; byteLength: number }): boolean {
	return Boolean(result.spillPath) || isLargeDump(result.byteLength);
}
