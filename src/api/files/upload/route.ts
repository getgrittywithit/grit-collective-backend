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

    // Mock successful file upload response
    const mockUploadedFile = {
      id: `file_upload_${Date.now()}`,
      name: "uploaded-file.jpg", 
      url: `https://medusa-public-images.s3.eu-west-1.amazonaws.com/sample-upload-${Date.now()}.jpg`,
      type: "image/jpeg",
      size: Math.floor(Math.random() * 1000000) + 100000,
      created_at: new Date().toISOString(),
      uploaded_by: "admin_user"
    };

    logger.info(`Mock file upload successful: ${mockUploadedFile.name}`);

    return res.status(201).json({
      success: true,
      message: "File uploaded successfully (mock)",
      file: mockUploadedFile,
      note: "File upload simulation - real storage integration needed for production"
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