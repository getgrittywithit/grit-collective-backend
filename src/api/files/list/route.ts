import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

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

    logger.info(`Fetching files: offset=${offset}, limit=${limit}`);

    // For now, return empty files list since file management might not be implemented
    // In a real implementation, you would query the file service or storage
    const files = [];
    const totalFiles = 0;

    return res.json({
      files,
      count: totalFiles,
      offset: Number(offset),
      limit: Number(limit),
      message: "File management not fully implemented yet - showing empty list"
    });

  } catch (error) {
    logger.error("Failed to fetch files:", error);
    return res.status(500).json({
      error: "Failed to fetch files",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}