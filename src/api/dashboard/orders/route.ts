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
  const orderModuleService = req.scope.resolve(Modules.ORDER);

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

    logger.info(`Fetching orders: offset=${offset}, limit=${limit}`);

    const orders = await orderModuleService.listOrders(
      {},
      {
        skip: Number(offset),
        take: Number(limit),
        relations: [
          "items",
          "shipping_address", 
          "billing_address"
        ]
      }
    );

    const totalOrders = await orderModuleService.listOrders({}, { take: null });

    return res.json({
      orders,
      count: totalOrders.length,
      offset: Number(offset),
      limit: Number(limit)
    });

  } catch (error) {
    logger.error("Failed to fetch orders:", error);
    return res.status(500).json({
      error: "Failed to fetch orders",
      details: error.message
    });
  }
}