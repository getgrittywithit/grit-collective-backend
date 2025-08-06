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

    // Return empty files list for now - file management would need to be implemented
    // This could integrate with Medusa's file service or external storage like S3
    const mockFiles = [
      {
        id: "file_1",
        name: "sample-product-image.jpg",
        url: "https://medusa-public-images.s3.eu-west-1.amazonaws.com/tee-black-front.png",
        type: "image/jpeg",
        size: 1024000,
        created_at: new Date().toISOString()
      }
    ];

    return res.json({
      files: mockFiles,
      count: mockFiles.length,
      offset: Number(offset),
      limit: Number(limit),
      note: "File management system not fully implemented - showing sample data"
    });

  } catch (error) {
    logger.error("Failed to fetch files:", error);
    return res.status(500).json({
      error: "Failed to fetch files",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}