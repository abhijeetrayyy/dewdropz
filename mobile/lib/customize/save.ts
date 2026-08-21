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
//
// SENT AS BYTES, NOT AS BASE64 IN JSON.
//
// This used to read the entire file into a base64 STRING and post it inside a
// JSON body. base64 inflates by about a third, so the 10MB image the endpoint
// accepts became a ~13.3MB request — and the whole thing existed at once in the
// JS heap before it was even sent, which on a cheap Android is where the app
// dies rather than where the upload fails. It would also have hit most hosts'
// request-body cap in production while passing on a laptop.
//
// `FormData` with a file URI is React Native's own upload path: the bytes are
// streamed from disk by the native networking layer and never become a
// JavaScript string.
export async function uploadPickedImage(localUri: string): Promise<string> {
  const lower = localUri.toLowerCase();
  const contentType = lower.endsWith(".png")
    ? "image/png"
    : lower.endsWith(".webp")
    ? "image/webp"
    : "image/jpeg";
  const name = `upload.${contentType.split("/")[1]}`;

  const form = new FormData();
  // RN's FormData takes this shape for a file; the cast is the standard one —
  // the DOM lib types `append` for Blob/string only.
  form.append("file", { uri: localUri, name, type: contentType } as unknown as Blob);

  const res = await fetch(`${ENV.apiUrl}/api/mobile/uploads`, {
    method: "POST",
    // Content-Type is deliberately NOT set: it has to carry the multipart
    // boundary, and fetch generates that only when it is left alone.
    headers: { ...(await authHeader()) },
    body: form,
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
