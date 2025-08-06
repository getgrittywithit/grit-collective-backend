import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";
import { ProductStatus } from "@medusajs/framework/utils";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const salesChannelModuleService = req.scope.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = req.scope.resolve(Modules.STORE);

  try {
    logger.info("Starting production setup...");

    // Check if already set up
    const stores = await storeModuleService.listStores();
    if (!stores.length) {
      return res.status(500).json({ error: "No store found" });
    }

    const store = stores[0];

    // Check/create default sales channel
    let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
      name: "Default Sales Channel",
    });

    if (!defaultSalesChannel.length) {
      const { result: salesChannelResult } = await createSalesChannelsWorkflow(
        req.scope
      ).run({
        input: {
          salesChannelsData: [
            {
              name: "Default Sales Channel",
            },
          ],
        },
      });
      defaultSalesChannel = salesChannelResult;
    }

    // Update store with basic config
    await updateStoresWorkflow(req.scope).run({
      input: {
        selector: { id: store.id },
        update: {
          supported_currencies: [
            {
              currency_code: "usd",
              is_default: true,
            },
          ],
          default_sales_channel_id: defaultSalesChannel[0].id,
        },
      },
    });

    // Create region
    const { result: regionResult } = await createRegionsWorkflow(req.scope).run({
      input: {
        regions: [
          {
            name: "North America",
            currency_code: "usd",
            countries: ["us", "ca"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    });

    // Create publishable API key
    const { result: publishableApiKeyResult } = await createApiKeysWorkflow(
      req.scope
    ).run({
      input: {
        api_keys: [
          {
            title: "Store API Key",
            type: "publishable",
            created_by: "setup",
          },
        ],
      },
    });

    const publishableApiKey = publishableApiKeyResult[0];

    // Create sample product categories
    const { result: categoryResult } = await createProductCategoriesWorkflow(
      req.scope
    ).run({
      input: {
        product_categories: [
          {
            name: "T-Shirts",
            is_active: true,
          },
          {
            name: "Hoodies",
            is_active: true,
          },
        ],
      },
    });

    // Create sample product
    await createProductsWorkflow(req.scope).run({
      input: {
        products: [
          {
            title: "Sample T-Shirt",
            category_ids: [categoryResult[0].id],
            description: "A sample t-shirt for testing",
            handle: "sample-tshirt",
            status: ProductStatus.PUBLISHED,
            variants: [
              {
                title: "Medium",
                sku: "TSHIRT-M",
                prices: [
                  {
                    amount: 2500, // $25.00 in cents
                    currency_code: "usd",
                  },
                ],
              },
            ],
            sales_channels: [
              {
                id: defaultSalesChannel[0].id,
              },
            ],
          },
        ],
      },
    });

    logger.info("Setup completed successfully");

    return res.json({
      message: "Setup completed successfully",
      store_id: store.id,
      publishable_api_key: publishableApiKey.token,
      sales_channel_id: defaultSalesChannel[0].id,
      region_id: regionResult[0].id,
    });

  } catch (error) {
    logger.error("Setup failed:", error);
    return res.status(500).json({
      error: "Setup failed",
      details: error.message,
    });
  }
}