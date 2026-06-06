function escapeHtml(text: string): string {
	return text
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

export function getWebviewHtml(title: string, body: string, isError = false): string {
	const color = isError ? 'var(--vscode-errorForeground)' : 'var(--vscode-editor-foreground)';
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';" />
	<title>${escapeHtml(title)}</title>
	<style>
		body {
			margin: 0;
			padding: 16px;
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
			color: ${color};
			background: var(--vscode-editor-background);
		}
		pre {
			margin: 0;
			white-space: pre-wrap;
			word-break: break-word;
		}
	</style>
</head>
<body>
	<pre>${escapeHtml(body)}</pre>
</body>
</html>`;
}
