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
    const result = await printfulService.getSyncProducts();

    if (!result.success) {
      logger.error("Failed to fetch Printful sync products:", result.error);
      return res.status(500).json({
        error: "Failed to fetch sync products",
        details: result.error?.message
      });
    }

    res.json({
      sync_products: result.data,
      success: true
    });
  } catch (error) {
    logger.error("Error in GET /admin/printful/sync:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const printfulService: PrintfulService = req.scope.resolve("printfulService");
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    // Get catalog products for product sync
    const catalogResult = await printfulService.getCatalogProducts();

    if (!catalogResult.success) {
      logger.error("Failed to fetch Printful catalog:", catalogResult.error);
      return res.status(500).json({
        error: "Failed to fetch catalog products",
        details: catalogResult.error?.message
      });
    }

    // Get sync products
    const syncResult = await printfulService.getSyncProducts();

    if (!syncResult.success) {
      logger.error("Failed to fetch Printful sync products:", syncResult.error);
      return res.status(500).json({
        error: "Failed to fetch sync products",
        details: syncResult.error?.message
      });
    }

    res.json({
      message: "Product catalog synced successfully",
      catalog_products: catalogResult.data,
      sync_products: syncResult.data,
      success: true
    });
  } catch (error) {
    logger.error("Error in POST /admin/printful/sync:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}