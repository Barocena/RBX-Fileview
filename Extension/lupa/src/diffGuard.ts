let diffOperationDepth = 0;

export function beginDiffOperation(): void {
	diffOperationDepth += 1;
}

export function endDiffOperation(): void {
	setTimeout(() => {
		diffOperationDepth = Math.max(0, diffOperationDepth - 1);
	}, 3000);
}

export function isDiffOperationActive(): boolean {
	return diffOperationDepth > 0;
}
