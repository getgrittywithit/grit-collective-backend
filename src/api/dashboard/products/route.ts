import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

function isValidAuthToken(token: string): boolean {
  try {
    // Decode the base64 token we generate in /auth
    const decoded = Buffer.from(token, 'base64').toString();
    return decoded.includes('admin@gritcollective.com');
  } catch {
    return false;
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const productModuleService = req.scope.resolve(Modules.PRODUCT);

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

    logger.info(`Fetching products: offset=${offset}, limit=${limit}`);

    const products = await productModuleService.listProducts(
      {},
      {
        skip: Number(offset),
        take: Number(limit),
        relations: [
          "variants",
          "variants.prices", 
          "options",
          "options.values",
          "images",
          "tags"
        ]
      }
    );

    const totalProducts = await productModuleService.listProducts({}, { take: null });

    return res.json({
      products,
      count: totalProducts.length,
      offset: Number(offset),
      limit: Number(limit)
    });

  } catch (error) {
    logger.error("Failed to fetch products:", error);
    return res.status(500).json({
      error: "Failed to fetch products",
      details: error.message
    });
  }
}