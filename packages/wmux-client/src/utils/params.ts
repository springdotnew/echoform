export interface WmuxParams {
  readonly token: string;
  readonly wsUrl: string;
}

export function parseHashParams(): WmuxParams | null {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const token = params.get("token");
  const ws = params.get("ws");

  if (!token || !ws) return null;
  return { token, wsUrl: ws };
}
