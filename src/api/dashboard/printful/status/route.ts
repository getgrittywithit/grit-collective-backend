import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import PrintfulService from "../../../../modules/printful/service";

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

    const printfulService: PrintfulService = req.scope.resolve("printfulService");

    logger.info("Testing Printful connection...");

    // Check environment variables first
    const envCheck = {
      api_key_configured: !!process.env.PRINTFUL_API_KEY,
      store_id_configured: !!process.env.PRINTFUL_STORE_ID,
      webhook_secret_configured: !!process.env.PRINTFUL_WEBHOOK_SECRET
    };

    logger.info("Printful environment check:", envCheck);

    if (!envCheck.api_key_configured) {
      return res.json({
        success: false,
        connected: false,
        error: "PRINTFUL_API_KEY not configured in environment variables",
        environment: envCheck
      });
    }

    // Test connection and get store info
    const connectionTest = await printfulService.testConnection();
    const storeInfoResult = await printfulService.getStoreInfo();

    logger.info("Printful connection test result:", connectionTest);
    logger.info("Printful store info result:", storeInfoResult);

    return res.json({
      success: connectionTest.success,
      connected: connectionTest.success,
      connection_status: connectionTest.success ? "connected" : "failed",
      connection_error: connectionTest.error?.message,
      store_info: storeInfoResult.success ? storeInfoResult.data : null,
      environment: envCheck
    });

  } catch (error) {
    logger.error("Error in Dashboard Printful status:", error);
    return res.status(500).json({
      success: false,
      connected: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}