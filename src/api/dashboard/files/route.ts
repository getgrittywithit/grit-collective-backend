import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

function isValidAuthToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    return decoded.includes('admin@gritcollective.com');
  } catch {
    return false;
  }
}

function getContentType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
    'txt': 'text/plain',
    'json': 'application/json'
  };
  return types[ext || ''] || 'application/octet-stream';
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    // Check for Bearer token and validate it
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: "Unauthorized - No valid token provided"
      });
    }

    const token = authHeader.replace('Bearer ', '');
    if (!isValidAuthToken(token)) {
      return res.status(401).json({
        error: "Unauthorized - Invalid token"
      });
    }

    const { offset = 0, limit = 50 } = req.query;

    logger.info(`Fetching files via dashboard: offset=${offset}, limit=${limit}`);

    // Check for required R2 environment variables
    const r2Config = {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
      bucketName: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      publicUrl: process.env.CLOUDFLARE_R2_PUBLIC_URL
    };

    const missingVars = Object.entries(r2Config).filter(([key, value]) => !value).map(([key]) => key);
    
    if (missingVars.length > 0) {
      logger.warn(`Missing R2 environment variables: ${missingVars.join(', ')}`);
      
      return res.status(503).json({
        files: [],
        count: 0,
        offset: Number(offset),
        limit: Number(limit),
        error: "R2 storage not configured",
        missing_env_vars: missingVars
      });
    }

    try {
      // Create S3 client for R2
      const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${r2Config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: r2Config.accessKeyId!,
          secretAccessKey: r2Config.secretAccessKey!,
        },
      });

      logger.info(`Listing files in R2 bucket: ${r2Config.bucketName}`);

      // List objects in R2 bucket
      const listCommand = new ListObjectsV2Command({
        Bucket: r2Config.bucketName!,
        MaxKeys: Number(limit),
        StartAfter: Number(offset) > 0 ? `uploads/${offset}` : undefined
      });

      const listResult = await s3Client.send(listCommand);
      
      const files = (listResult.Contents || []).map(obj => ({
        id: `file_${obj.Key?.replace(/[^a-zA-Z0-9]/g, '_')}`,
        name: obj.Key?.split('/').pop() || obj.Key || 'unknown',
        filename: obj.Key || '',
        url: `${r2Config.publicUrl}/${obj.Key}`,
        type: getContentType(obj.Key || ''),
        size: obj.Size || 0,
        created_at: obj.LastModified?.toISOString() || new Date().toISOString(),
        r2_key: obj.Key,
        bucket: r2Config.bucketName
      }));

      logger.info(`Found ${files.length} files in R2 bucket`);

      return res.json({
        files,
        count: listResult.KeyCount || 0,
        total: listResult.KeyCount || 0,
        offset: Number(offset),
        limit: Number(limit),
        bucket: r2Config.bucketName,
        next_offset: listResult.IsTruncated ? (Number(offset) + Number(limit)) : null
      });

    } catch (r2Error) {
      logger.error("R2 list files error:", r2Error);
      return res.status(500).json({
        files: [],
        count: 0,
        offset: Number(offset),
        limit: Number(limit),
        error: "Failed to list files from R2",
        details: r2Error instanceof Error ? r2Error.message : "Unknown R2 error"
      });
    }

  } catch (error) {
    logger.error("Failed to fetch files:", error);
    return res.status(500).json({
      error: "Failed to fetch files",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}