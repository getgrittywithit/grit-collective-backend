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

    const { offset = 0, limit = 20, category_id, search } = req.query;

    logger.info(`Fetching Printful products: offset=${offset}, limit=${limit}, search=${search}`);

    try {
      const printfulService: any = req.scope.resolve("printfulService");
      
      // Test connection first
      const connectionTest = await printfulService.testConnection();
      if (!connectionTest.success) {
        return res.status(503).json({
          success: false,
          error: "Printful not connected",
          details: connectionTest.error?.message || "Connection failed"
        });
      }

      // Get products from Printful
      const products = await printfulService.getProducts({
        offset: Number(offset),
        limit: Number(limit),
        category_id,
        search
      });

      logger.info(`Retrieved ${products?.length || 0} Printful products`);

      return res.json({
        success: true,
        products: products || [],
        pagination: {
          offset: Number(offset),
          limit: Number(limit),
          count: products?.length || 0,
          has_more: (products?.length || 0) >= Number(limit)
        },
        filters: {
          category_id,
          search
        }
      });

    } catch (serviceError) {
      logger.error("Printful products error:", serviceError);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch Printful products",
        details: serviceError instanceof Error ? serviceError.message : "Unknown error"
      });
    }

  } catch (error) {
    logger.error("Printful products request failed:", error);
    return res.status(500).json({
      success: false,
      error: "Printful products request failed", 
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}