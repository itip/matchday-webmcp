type WebMcpTool = { name: string; description: string; inputSchema: Record<string, unknown>; annotations?: { readOnlyHint?: boolean }; execute: (input: any) => Promise<unknown> };
interface Document { modelContext?: { registerTool: (tool: WebMcpTool, options?: { signal?: AbortSignal }) => Promise<void> } }
