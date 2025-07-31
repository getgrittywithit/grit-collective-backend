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
    // Test connection and get store info
    const connectionTest = await printfulService.testConnection();
    const storeInfoResult = await printfulService.getStoreInfo();

    res.json({
      connection_status: connectionTest.success ? "connected" : "failed",
      connection_error: connectionTest.error?.message,
      store_info: storeInfoResult.success ? storeInfoResult.data : null,
      environment: {
        api_key_configured: !!process.env.PRINTFUL_API_KEY,
        store_id_configured: !!process.env.PRINTFUL_STORE_ID,
        webhook_secret_configured: !!process.env.PRINTFUL_WEBHOOK_SECRET
      },
      success: true
    });
  } catch (error) {
    logger.error("Error in GET /admin/printful/status:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error",
      success: false
    });
  }
}