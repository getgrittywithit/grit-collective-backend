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

    logger.info("Printful status check via dashboard...");

    // Check environment variables
    const envCheck = {
      api_key_configured: !!process.env.PRINTFUL_API_KEY,
      api_key_length: process.env.PRINTFUL_API_KEY ? process.env.PRINTFUL_API_KEY.length : 0,
      store_id_configured: !!process.env.PRINTFUL_STORE_ID,
      store_id_value: process.env.PRINTFUL_STORE_ID || 'not_configured',
      webhook_secret_configured: !!process.env.PRINTFUL_WEBHOOK_SECRET
    };

    logger.info(`Printful environment check: ${JSON.stringify(envCheck)}`);

    if (!envCheck.api_key_configured) {
      return res.json({
        success: false,
        connected: false,
        error: "PRINTFUL_API_KEY not configured in Railway environment variables",
        environment: envCheck,
        fix: "Add PRINTFUL_API_KEY to Railway environment variables in your project settings"
      });
    }

    // Try to resolve and test Printful service
    try {
      const printfulService: any = req.scope.resolve("printfulService");
      logger.info("PrintfulService resolved successfully");

      const connectionTest = await printfulService.testConnection();
      logger.info(`Printful connection test result: ${JSON.stringify(connectionTest)}`);

      // Get additional Printful info
      const storeInfo = await printfulService.getStoreInfo();
      
      return res.json({
        success: connectionTest.success,
        connected: connectionTest.success,
        error: connectionTest.success ? null : (connectionTest.error?.message || "Connection failed"),
        environment: envCheck,
        store: storeInfo || null,
        api_usage: {
          calls_made: "Available via Printful API",
          rate_limit: "120 calls per minute"
        },
        features: {
          product_sync: true,
          order_fulfillment: true,
          webhook_support: envCheck.webhook_secret_configured,
          automatic_shipping: true
        }
      });

    } catch (serviceError) {
      logger.error("Printful service error:", serviceError);
      return res.json({
        success: false,
        connected: false,
        error: "Printful service resolution failed",
        details: serviceError instanceof Error ? serviceError.message : "Unknown error",
        environment: envCheck
      });
    }

  } catch (error) {
    logger.error("Printful status check failed:", error);
    return res.status(500).json({
      success: false,
      connected: false,
      error: "Printful status check failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}