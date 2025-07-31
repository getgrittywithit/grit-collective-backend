import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import PrintfulService from "../../../../../modules/printful/service";

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const printfulService: PrintfulService = req.scope.resolve("printfulService");
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "Order ID is required"
      });
    }

    const result = await printfulService.getOrder(id);

    if (!result.success) {
      logger.error(`Failed to fetch Printful order ${id}:`, result.error);
      
      if (result.error?.code === 404) {
        return res.status(404).json({
          error: "Order not found",
          details: result.error.message
        });
      }

      return res.status(500).json({
        error: "Failed to fetch order",
        details: result.error?.message
      });
    }

    res.json({
      order: result.data,
      success: true
    });
  } catch (error) {
    logger.error(`Error in GET /admin/printful/orders/${req.params.id}:`, error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const printfulService: PrintfulService = req.scope.resolve("printfulService");
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: "Order ID is required"
      });
    }

    const result = await printfulService.cancelOrder(id);

    if (!result.success) {
      logger.error(`Failed to cancel Printful order ${id}:`, result.error);

      if (result.error?.code === 404) {
        return res.status(404).json({
          error: "Order not found",
          details: result.error.message
        });
      }

      return res.status(500).json({
        error: "Failed to cancel order",
        details: result.error?.message
      });
    }

    res.json({
      message: "Order canceled successfully",
      success: true
    });
  } catch (error) {
    logger.error(`Error in DELETE /admin/printful/orders/${req.params.id}:`, error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}