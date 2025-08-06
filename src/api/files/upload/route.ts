import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

function isValidAuthToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    return decoded.includes('admin@gritcollective.com');
  } catch {
    return false;
  }
}

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
      
      // Return mock response for now
      const mockUploadedFile = {
        id: `file_upload_${Date.now()}`,
        name: "uploaded-file.jpg", 
        url: `https://your-r2-bucket.your-account.r2.cloudflarestorage.com/uploads/${Date.now()}-uploaded-file.jpg`,
        type: "image/jpeg",
        size: Math.floor(Math.random() * 1000000) + 100000,
        created_at: new Date().toISOString(),
        uploaded_by: "admin_user"
      };

      return res.status(201).json({
        success: true,
        message: "File uploaded successfully (mock - R2 not configured)",
        file: mockUploadedFile,
        missing_env_vars: missingVars,
        note: "Add R2 environment variables to enable real file uploads to Cloudflare R2"
      });
    }

    // TODO: Implement actual R2 upload
    // For now, return success with R2-style URL
    const fileName = `${Date.now()}-uploaded-file.jpg`;
    const uploadedFile = {
      id: `file_${Date.now()}`,
      name: fileName,
      url: `${r2Config.publicUrl}/${fileName}`,
      type: "image/jpeg", 
      size: Math.floor(Math.random() * 1000000) + 100000,
      created_at: new Date().toISOString(),
      uploaded_by: "admin_user"
    };

    logger.info(`File upload ready for R2: ${fileName}`);

    return res.status(201).json({
      success: true,
      message: "File upload configured for Cloudflare R2",
      file: uploadedFile,
      note: "R2 configuration detected - real upload implementation needed"
    });

  } catch (error) {
    logger.error("File upload error:", error);
    return res.status(500).json({
      success: false,
      error: "File upload failed", 
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}