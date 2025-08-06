import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  
  try {
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
        test_auth: `curl -X POST -H "Content-Type: application/json" -d '{"email":"admin@gritcollective.com","password":"admin123"}' https://medusa-store-v2-production.up.railway.app/auth`
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