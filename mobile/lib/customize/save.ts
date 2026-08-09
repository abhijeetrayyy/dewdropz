import * as FileSystem from "expo-file-system";
import { supabase } from "../supabase";
import { ENV } from "../env";
import type { DesignLayer } from "./types";

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

// A picked photo lives at a local file:// URI that only this device can read,
// so it has to be uploaded before it can be part of a design — the server
// renders the print file and needs to fetch the artwork by URL.
export async function uploadPickedImage(localUri: string): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: "base64" });

  const lower = localUri.toLowerCase();
  const contentType = lower.endsWith(".png")
    ? "image/png"
    : lower.endsWith(".webp")
    ? "image/webp"
    : "image/jpeg";

  const res = await fetch(`${ENV.apiUrl}/api/mobile/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ data: base64, contentType }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.url) {
    throw new Error(typeof data?.error === "string" ? data.error : "Could not upload that image.");
  }
  return data.url as string;
}

export type SaveDesignResult = { designId: string; previewUrl: string | null };

// Sends the design as structured layer data and lets the server rasterize it.
// Nothing is captured on-device: the print file's resolution is decided
// server-side, and both platforms go through the identical renderer, so an
// iPhone and an Android phone produce the same print file for the same design.
export async function saveDesign(input: {
  productId: string;
  variantId?: string | null;
  colorName?: string;
  colorHex?: string;
  front: DesignLayer[];
  back: DesignLayer[];
}): Promise<SaveDesignResult> {
  // Strip the local-only `id` — it's for React keys, not for the renderer.
  const strip = (layers: DesignLayer[]) =>
    layers.map((layer) => {
      const { id, ...rest } = layer;
      void id;
      return rest;
    });

  if (input.front.length === 0 && input.back.length === 0) {
    throw new Error("Add some text or an image before saving.");
  }

  const res = await fetch(`${ENV.apiUrl}/api/mobile/designs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({
      productId: input.productId,
      variantId: input.variantId ?? null,
      colorName: input.colorName,
      colorHex: input.colorHex,
      ...(input.front.length ? { front: strip(input.front) } : {}),
      ...(input.back.length ? { back: strip(input.back) } : {}),
    }),
  });

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.designId) {
    const msg = typeof data?.error === "string" ? data.error : "Could not save your design.";
    throw new Error(msg);
  }
  return { designId: data.designId as string, previewUrl: data.previewUrl ?? null };
}
