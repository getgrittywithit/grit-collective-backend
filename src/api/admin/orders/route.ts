import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const orderModuleService = req.scope.resolve(Modules.ORDER);

  try {
    // Simple auth check - in production, implement proper JWT verification
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: "Unauthorized - No valid token provided"
      });
    }

    const { offset = 0, limit = 50 } = req.query;

    const orders = await orderModuleService.listOrders(
      {},
      {
        skip: Number(offset),
        take: Number(limit),
        relations: [
          "items",
          "shipping_address",
          "billing_address",
          "customer"
        ]
      }
    );

    const count = await orderModuleService.listOrders({}, { take: null });

    return res.json({
      orders,
      count: count.length,
      offset: Number(offset),
      limit: Number(limit)
    });

  } catch (error) {
    logger.error("Failed to fetch orders:", error);
    return res.status(500).json({
      error: "Failed to fetch orders"
    });
  }
}