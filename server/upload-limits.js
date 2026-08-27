const MEBIBYTE = 1_048_576;
const DEFAULT_MAX_UPLOAD_MB = 12;
const MULTIPART_OVERHEAD_BYTES = MEBIBYTE;

/**
 * Parse the byte syntax accepted by adapter-node (`512K`, `16M`, `1G`, or bytes).
 *
 * @param {string | undefined} value
 */
function parseBodySizeLimit(value) {
  const normalized = value?.trim();
  if (!normalized) return null;
  if (normalized.toLowerCase() === 'infinity') return Infinity;
  const suffix = normalized.at(-1)?.toUpperCase();
  const multiplier =
    suffix === 'K' ? 1024 : suffix === 'M' ? MEBIBYTE : suffix === 'G' ? 1024 ** 3 : 1;
  const amount = Number(multiplier === 1 ? normalized : normalized.slice(0, -1));
  return Number.isFinite(amount) && amount >= 0 ? amount * multiplier : null;
}

/**
 * Ensure adapter-node can receive every image that Atlore itself accepts. The
 * additional MiB leaves room for multipart field names, boundaries, and headers.
 * Larger explicit BODY_SIZE_LIMIT values (including Infinity) remain untouched.
 *
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} environment
 */
export function ensureUploadBodySizeLimit(environment = process.env) {
  const configuredUploadMb = Number(environment.MAX_UPLOAD_MB ?? DEFAULT_MAX_UPLOAD_MB);
  const maxUploadMb =
    Number.isFinite(configuredUploadMb) && configuredUploadMb > 0
      ? configuredUploadMb
      : DEFAULT_MAX_UPLOAD_MB;
  const requiredBytes = Math.ceil(maxUploadMb * MEBIBYTE) + MULTIPART_OVERHEAD_BYTES;
  const configuredBodyLimit = parseBodySizeLimit(environment.BODY_SIZE_LIMIT);

  if (configuredBodyLimit === Infinity || (configuredBodyLimit ?? -1) >= requiredBytes) {
    return environment.BODY_SIZE_LIMIT;
  }

  environment.BODY_SIZE_LIMIT = String(requiredBytes);
  return environment.BODY_SIZE_LIMIT;
}
