import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import { promisify } from "util";

function isValidAuthToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    return decoded.includes('admin@gritcollective.com');
  } catch {
    return false;
  }
}

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

const uploadSingle = promisify(upload.single('file'));

export async function POST(req: MedusaRequest, res: MedusaResponse) {
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

    logger.info("File upload request received at /files/upload");

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
        success: false,
        error: "R2 storage not configured",
        missing_env_vars: missingVars,
        note: "Add R2 environment variables to Railway to enable file uploads"
      });
    }

    // Parse multipart form data
    try {
      await uploadSingle(req as any, res as any);
    } catch (multerError) {
      logger.error("Multer parsing error:", multerError);
      return res.status(400).json({
        success: false,
        error: "File parsing failed",
        details: multerError instanceof Error ? multerError.message : "Invalid file format"
      });
    }

    const file = (req as any).file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: "No file uploaded",
        note: "Send file as 'file' field in multipart form data"
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `uploads/${timestamp}-${cleanName}`;

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

      logger.info(`Uploading ${fileName} to R2 bucket: ${r2Config.bucketName}`);

      // Upload to R2
      const uploadCommand = new PutObjectCommand({
        Bucket: r2Config.bucketName!,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ContentLength: file.size,
      });

      await s3Client.send(uploadCommand);

      const uploadedFile = {
        id: `file_${timestamp}`,
        name: file.originalname,
        filename: fileName,
        url: `${r2Config.publicUrl}/${fileName}`,
        type: file.mimetype,
        size: file.size,
        created_at: new Date().toISOString(),
        uploaded_by: "admin_user",
        bucket: r2Config.bucketName,
        r2_key: fileName
      };

      logger.info(`R2 upload successful: ${fileName} (${file.size} bytes)`);

      return res.status(201).json({
        success: true,
        message: "File uploaded successfully to Cloudflare R2",
        file: uploadedFile
      });

    } catch (uploadError) {
      logger.error("R2 upload error:", uploadError);
      return res.status(500).json({
        success: false,
        error: "R2 upload failed",
        details: uploadError instanceof Error ? uploadError.message : "Unknown upload error"
      });
    }

  } catch (error) {
    logger.error("File upload error:", error);
    return res.status(500).json({
      success: false,
      error: "File upload failed", 
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}