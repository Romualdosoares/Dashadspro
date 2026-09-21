const DEFAULT_GRAPH_API_VERSION = "v24.0";

function resolveGraphApiVersion(): string {
  const configured = process.env.META_GRAPH_API_VERSION?.trim();
  if (!configured) return DEFAULT_GRAPH_API_VERSION;
  if (!/^v\d+\.\d+$/.test(configured)) {
    throw new Error("META_GRAPH_API_VERSION invalida");
  }
  return configured;
}

export const GRAPH_BASE = `https://graph.facebook.com/${resolveGraphApiVersion()}`;
