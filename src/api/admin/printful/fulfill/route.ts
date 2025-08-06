import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import PrintfulService from "../../../../modules/printful/service";

interface FulfillOrderRequest {
  medusa_order_id: string;
  confirm_immediately?: boolean;
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const printfulService: PrintfulService = req.scope.resolve("printfulService");
  const orderModuleService = req.scope.resolve(Modules.ORDER);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const { medusa_order_id, confirm_immediately = false }: FulfillOrderRequest = req.body as FulfillOrderRequest;

    if (!medusa_order_id) {
      return res.status(400).json({
        error: "medusa_order_id is required"
      });
    }

    // Get the Medusa order
    const order = await orderModuleService.retrieveOrder(medusa_order_id, {
      relations: ["items", "shipping_address"]
    });

    if (!order) {
      return res.status(404).json({
        error: "Medusa order not found"
      });
    }

    // Check if order already has a Printful order ID
    const existingPrintfulOrderId = order.metadata?.printful_order_id;
    if (existingPrintfulOrderId) {
      logger.info(`Order ${medusa_order_id} already has Printful order ${existingPrintfulOrderId}`);
      
      // Get the existing Printful order status
      const existingOrder = await printfulService.getOrder(existingPrintfulOrderId as string);
      
      return res.json({
        message: "Order already has Printful fulfillment",
        printful_order_id: existingPrintfulOrderId,
        printful_order: existingOrder.data,
        success: true
      });
    }

    // Create new Printful order
    const createResult = await printfulService.createOrder(order);

    if (!createResult.success) {
      logger.error(`Failed to create Printful order for ${medusa_order_id}:`, createResult.error);
      return res.status(500).json({
        error: "Failed to create Printful order",
        details: createResult.error?.message
      });
    }

    const printfulOrder = createResult.data!;
    
    // Store Printful order ID in Medusa order metadata
    await orderModuleService.updateOrders(medusa_order_id, {
      metadata: {
        ...order.metadata,
        printful_order_id: printfulOrder.id.toString(),
        printful_external_id: printfulOrder.external_id
      }
    });

    // Confirm order for immediate fulfillment if requested
    if (confirm_immediately) {
      const confirmResult = await printfulService.confirmOrder(printfulOrder.id.toString());
      
      if (!confirmResult.success) {
        logger.warn(`Created Printful order ${printfulOrder.id} but failed to confirm:`);
        return res.json({
          message: "Printful order created but confirmation failed",
          printful_order_id: printfulOrder.id,
          printful_order: printfulOrder,
          confirm_error: confirmResult.error?.message,
          success: true
        });
      }

      logger.info(`Created and confirmed Printful order ${printfulOrder.id} for ${medusa_order_id}`);
    }

    res.json({
      message: confirm_immediately ? "Order created and confirmed in Printful" : "Order created in Printful",
      printful_order_id: printfulOrder.id,
      printful_order: printfulOrder,
      success: true
    });

  } catch (error) {
    logger.error("Error in POST /admin/printful/fulfill:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}