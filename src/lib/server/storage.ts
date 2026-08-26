import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '$lib/server/config';

const useS3 = !!(env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);
const s3 = useS3
  ? new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: true,
      credentials: { accessKeyId: env.S3_ACCESS_KEY!, secretAccessKey: env.S3_SECRET_KEY! }
    })
  : null;

export async function putObject(
  key: string,
  bytes: Uint8Array,
  contentType: string
): Promise<void> {
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: contentType
      })
    );
    return;
  }
  const target = safeLocalPath(key);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes, { flag: 'wx' });
}

export async function getObject(key: string): Promise<Uint8Array> {
  if (s3) {
    const result = await s3.send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
    if (!result.Body) throw new Error('Object body ontbreekt.');
    return result.Body.transformToByteArray();
  }
  return readFile(safeLocalPath(key));
}

function safeLocalPath(key: string): string {
  if (!/^[a-zA-Z0-9/_-]+$/.test(key) || key.includes('..'))
    throw new Error('Ongeldige storage key.');
  const root = resolve(env.STORAGE_PATH);
  const target = resolve(join(root, key));
  if (!target.startsWith(`${root}/`)) throw new Error('Ongeldige storage key.');
  return target;
}
