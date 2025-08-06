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
      const result = await printfulService.getCatalogProducts(category_id ? Number(category_id) : undefined);
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get products');
      }
      
      const allProducts = result.data || [];
      
      // Apply search filter if provided
      let filteredProducts = allProducts;
      if (search) {
        const searchTerm = search.toString().toLowerCase();
        filteredProducts = allProducts.filter(product => 
          product.title?.toLowerCase().includes(searchTerm) ||
          product.description?.toLowerCase().includes(searchTerm)
        );
      }
      
      // Apply pagination
      const startIndex = Number(offset);
      const endIndex = startIndex + Number(limit);
      const products = filteredProducts.slice(startIndex, endIndex);

      logger.info(`Retrieved ${products?.length || 0} Printful products`);

      return res.json({
        success: true,
        products: products || [],
        pagination: {
          offset: Number(offset),
          limit: Number(limit),
          count: products?.length || 0,
          total: filteredProducts.length,
          has_more: endIndex < filteredProducts.length
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