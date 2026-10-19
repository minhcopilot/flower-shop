export async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "X-Shop-Request": "1",
      ...options.headers,
    },
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({
    error: "Không kết nối được máy chủ. Vui lòng kiểm tra website đang chạy.",
  }));
  if (!response.ok)
    throw new Error(data.error || "Không thể hoàn tất. Vui lòng thử lại.");
  return data as T;
}
export const mediaUrl = (id: string) => `/media/${id}`;
