import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import PrintfulService from "../../../../modules/printful/service";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const printfulService: PrintfulService = req.scope.resolve("printfulService");
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const { status, limit, offset } = req.query;
    
    const result = await printfulService.getOrders(
      status as string,
      limit ? parseInt(limit as string) : 100,
      offset ? parseInt(offset as string) : 0
    );

    if (!result.success) {
      logger.error("Failed to fetch Printful orders:", result.error);
      return res.status(500).json({
        error: "Failed to fetch orders",
        details: result.error?.message
      });
    }

    res.json({
      orders: result.data,
      success: true
    });
  } catch (error) {
    logger.error("Error in GET /admin/printful/orders:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}