import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  
  try {
    const productModuleService = req.scope.resolve(Modules.PRODUCT);
    const orderModuleService = req.scope.resolve(Modules.ORDER);

    // Test basic product fetching
    const products = await productModuleService.listProducts({}, {
      take: 2,
      relations: ["variants", "images"]
    });

    const orders = await orderModuleService.listOrders({}, {
      take: 2
    });

    return res.json({
      debug: "API endpoints status",
      status: {
        products_count: products.length,
        orders_count: orders.length,
        sample_product: products[0] ? {
          id: products[0].id,
          title: products[0].title,
          variants_count: products[0].variants?.length || 0
        } : null
      },
      endpoints: {
        store_products: "GET /store/products (with x-publishable-api-key header)",
        admin_auth: "POST /auth (with email/password)",
        dashboard_products: "GET /dashboard/products (with Bearer token)",
        dashboard_orders: "GET /dashboard/orders (with Bearer token)"
      }
    });

  } catch (error) {
    logger.error("Debug endpoint error:", error);
    return res.status(500).json({
      error: "Debug failed",
      details: error.message
    });
  }
}