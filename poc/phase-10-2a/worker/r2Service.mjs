import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const UPLOAD_URL_TTL_SECONDS = 300;
const DOWNLOAD_URL_TTL_SECONDS = 300;

function getR2Config(env) {
  const { R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env;
  if (!R2_ACCOUNT_ID || !R2_BUCKET_NAME || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    const err = new Error('Cloudflare R2 is not configured for this environment');
    err.code = 'R2_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }

  const endpoint = env.R2_S3_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  let endpointUrl;
  try {
    endpointUrl = new URL(endpoint);
  } catch {
    const err = new Error('Cloudflare R2 endpoint configuration is invalid');
    err.code = 'R2_CONFIGURATION_INVALID';
    err.status = 503;
    throw err;
  }
  if (endpointUrl.protocol !== 'https:' || endpointUrl.username || endpointUrl.password) {
    const err = new Error('Cloudflare R2 endpoint must be a credential-free HTTPS URL');
    err.code = 'R2_CONFIGURATION_INVALID';
    err.status = 503;
    throw err;
  }

  return {
    endpoint: endpointUrl.toString().replace(/\/+$/, ''),
    bucket: R2_BUCKET_NAME,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY
    }
  };
}

function getR2Client(env) {
  const config = getR2Config(env);
  return {
    config,
    client: new S3Client({
      endpoint: config.endpoint,
      region: 'auto',
      forcePathStyle: true,
      credentials: config.credentials
    })
  };
}

export function sha256HexToBase64(hex) {
  const bytes = new Uint8Array(hex.match(/.{2}/g).map((part) => parseInt(part, 16)));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function createPresignedUpload(env, { objectKey, mimeType, fileHash }) {
  if (env.__MOCK_R2__) {
    return env.__MOCK_R2__.presignUpload({ objectKey, mimeType, fileHash });
  }

  const { client, config } = getR2Client(env);
  const checksum = sha256HexToBase64(fileHash);
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    ContentType: mimeType,
    ChecksumSHA256: checksum,
    Metadata: { sha256: fileHash }
  });
  const url = await getSignedUrl(client, command, {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    signableHeaders: new Set(['content-type']),
    unhoistableHeaders: new Set(['x-amz-checksum-sha256', 'x-amz-meta-sha256'])
  });

  return {
    url,
    expiresIn: UPLOAD_URL_TTL_SECONDS,
    requiredHeaders: {
      'Content-Type': mimeType,
      'x-amz-checksum-sha256': checksum,
      'x-amz-meta-sha256': fileHash
    }
  };
}

export async function headR2Object(env, objectKey) {
  if (env.__MOCK_R2__) {
    return env.__MOCK_R2__.headObject(objectKey);
  }

  const { client, config } = getR2Client(env);
  const result = await client.send(new HeadObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    ChecksumMode: 'ENABLED'
  }));
  return {
    fileSize: result.ContentLength,
    mimeType: result.ContentType,
    fileHash: result.Metadata?.sha256,
    checksumSha256: result.ChecksumSHA256
  };
}

export async function createPresignedDownload(env, { objectKey, mimeType, fileName, disposition }) {
  if (env.__MOCK_R2__) {
    return env.__MOCK_R2__.presignDownload({ objectKey, mimeType, fileName, disposition });
  }

  const { client, config } = getR2Client(env);
  const safeName = encodeURIComponent(fileName).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: objectKey,
    ResponseContentType: mimeType,
    ResponseContentDisposition: `${disposition}; filename*=UTF-8''${safeName}`
  });
  const url = await getSignedUrl(client, command, { expiresIn: DOWNLOAD_URL_TTL_SECONDS });
  return { url, expiresIn: DOWNLOAD_URL_TTL_SECONDS };
}

export async function deleteR2Object(env, objectKey) {
  if (env.__MOCK_R2__) {
    return env.__MOCK_R2__.deleteObject(objectKey);
  }
  const { client, config } = getR2Client(env);
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey }));
}

export async function checkR2Health(env) {
  if (env.__MOCK_R2__) {
    return env.__MOCK_R2__.health();
  }
  const { client, config } = getR2Client(env);
  await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  return true;
}

export { UPLOAD_URL_TTL_SECONDS, DOWNLOAD_URL_TTL_SECONDS };
