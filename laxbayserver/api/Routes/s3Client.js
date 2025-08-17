import { S3Client } from "@aws-sdk/client-s3";

// Supports AWS S3 or any S3-compatible (Cloudflare R2, Wasabi, etc.)
export function makeS3() {
  const region  = process.env.S3_REGION || "auto";      // "auto" fine for R2
  const bucket  = process.env.S3_BUCKET;                // required
  const access  = process.env.S3_ACCESS_KEY_ID;         // required
  const secret  = process.env.S3_SECRET_ACCESS_KEY;     // required
  const endpoint = process.env.S3_ENDPOINT || "";       // e.g. https://<account>.r2.cloudflarestorage.com
  if (!bucket || !access || !secret) throw new Error("S3 env vars missing");

  const client = new S3Client({
    region,
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint), // usually needed for R2/compat endpoints
    credentials: { accessKeyId: access, secretAccessKey: secret },
  });

  return { client, bucket, endpoint };
}

// Build a public URL for the object (prefer CDN/custom domain if provided)
export function objectPublicUrl(key) {
  // If you’ve set a CDN OR static site for the bucket, put it here:
  const base = process.env.S3_PUBLIC_BASE_URL || ""; // e.g. https://cdn.laxbay.com
  if (base) return `${base.replace(/\/+$/,"")}/${encodeURIComponent(key)}`;
  // Fallback: virtual-hosted style for AWS; path-style for custom endpoints
  const { S3_BUCKET, S3_REGION, S3_ENDPOINT } = process.env;
  if (S3_ENDPOINT) { // compat (R2, Wasabi…)
    return `${S3_ENDPOINT.replace(/\/+$/,"")}/${S3_BUCKET}/${encodeURIComponent(key)}`;
  }
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${encodeURIComponent(key)}`;
}
