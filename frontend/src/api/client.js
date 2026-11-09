/** Relative `/api` paths — Vite proxies locally; CloudFront in production. */

export async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;

  if (body != null && typeof body === "object" && !(body instanceof Blob) && !(body instanceof FormData) && !(body instanceof ArrayBuffer)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    body = JSON.stringify(body);
  }

  const response = await fetch(path, {
    ...options,
    headers,
    body,
    credentials: options.credentials ?? "include",
  });

  return response;
}

export async function apiJson(path, options = {}) {
  const response = await apiFetch(path, options);
  let data = null;
  const text = await response.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }
  if (!response.ok) {
    const error = new Error(data?.error || response.statusText || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
