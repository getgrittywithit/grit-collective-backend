import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  
  try {
    // Check if this is a Printful status request
    if (req.query.printful === 'true') {
      logger.info("Printful status check requested...");

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

        return res.json({
          success: connectionTest.success,
          connected: connectionTest.success,
          error: connectionTest.success ? null : (connectionTest.error?.message || "Connection failed"),
          environment: envCheck
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
    }

    // Regular status endpoint (existing functionality)
    const storeModuleService = req.scope.resolve(Modules.STORE);
    const salesChannelModuleService = req.scope.resolve(Modules.SALES_CHANNEL);
    const productModuleService = req.scope.resolve(Modules.PRODUCT);
    const apiKeyModuleService = req.scope.resolve(Modules.API_KEY);

    const stores = await storeModuleService.listStores();
    const salesChannels = await salesChannelModuleService.listSalesChannels();
    const products = await productModuleService.listProducts();
    const apiKeys = await apiKeyModuleService.listApiKeys({
      type: "publishable"
    });

    return res.json({
      status: "Database Status Check",
      data: {
        stores: stores.length,
        sales_channels: salesChannels.length,
        products: products.length,
        api_keys: apiKeys.length,
      },
      details: {
        store_ids: stores.map(s => s.id),
        publishable_keys: apiKeys.map(key => ({
          id: key.id,
          title: key.title,
          token: key.token,
          created_at: key.created_at
        }))
      },
      next_steps: apiKeys.length > 0 ? {
        test_store_api: `curl -H "x-publishable-api-key: ${apiKeys[0].token}" https://medusa-store-v2-production.up.railway.app/store/products`,
        test_auth: `curl -X POST -H "Content-Type: application/json" -d '{"email":"admin@gritcollective.com","password":"admin123"}' https://medusa-store-v2-production.up.railway.app/auth`,
        test_printful: `curl "https://medusa-store-v2-production.up.railway.app/status?printful=true"`
      } : {
        need_setup: "Run POST /setup to create API keys and products"
      }
    });

  } catch (error) {
    logger.error("Status check failed:", error);
    return res.status(500).json({
      error: "Status check failed",
      details: error.message,
    });
  }
}