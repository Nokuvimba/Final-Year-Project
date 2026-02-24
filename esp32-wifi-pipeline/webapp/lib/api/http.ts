const isServer = typeof window === "undefined";

export const API_BASE = isServer
  ? `${process.env.NEXT_PUBLIC_SITE_URL}/api`
  : "/api";

export async function handleJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Request failed: ${res.status} ${res.statusText} ${text || ""}`.trim()
    );
  }
  return res.json() as Promise<T>;
}

export function getImageUrl(imageUrl: string): string {
  if (imageUrl.startsWith("http")) {
    return imageUrl;
  }
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  return `${baseUrl}${imageUrl}`;
}
