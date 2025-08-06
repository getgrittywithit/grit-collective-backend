import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import PrintfulService from "../../../modules/printful/service";
import { PrintfulWebhookPayload } from "../../../modules/printful/types";

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
) {
  const printfulService: PrintfulService = req.scope.resolve("printfulService");
  const orderModuleService = req.scope.resolve(Modules.ORDER);
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    const signature = req.headers['x-printful-signature'] as string;
    const payload: PrintfulWebhookPayload = req.body as PrintfulWebhookPayload;

    if (!payload || !payload.type) {
      return res.status(400).json({
        error: "Invalid webhook payload"
      });
    }

    logger.info(`Received Printful webhook: ${payload.type}`);

    // Handle the webhook using the service
    const result = await printfulService.handleWebhook(payload, signature);

    if (!result.success) {
      logger.error("Failed to process webhook:", result.error);
      return res.status(500).json({
        error: "Failed to process webhook",
        details: result.error?.message
      });
    }

    // Additional Medusa-specific webhook handling
    if (payload.data.order) {
      const medusaOrderId = payload.data.order.external_id;
      
      try {
        const order = await orderModuleService.retrieveOrder(medusaOrderId);
        
        if (!order) {
          logger.warn(`Medusa order ${medusaOrderId} not found for Printful webhook`);
          return res.json({ message: "Webhook processed (order not found in Medusa)" });
        }

        // Update order based on webhook type
        switch (payload.type) {
          case 'package_shipped':
            await handlePackageShipped(orderModuleService, order, payload, logger);
            break;
          
          case 'package_returned':
            await handlePackageReturned(orderModuleService, order, payload, logger);
            break;
          
          case 'order_failed':
            await handleOrderFailed(orderModuleService, order, payload, logger);
            break;
          
          case 'order_canceled':
            await handleOrderCanceled(orderModuleService, order, payload, logger);
            break;
        }

      } catch (orderError) {
        logger.error(`Error processing order ${medusaOrderId}:`, orderError);
        // Don't fail the webhook for order processing errors
      }
    }

    res.json({ 
      message: "Webhook processed successfully",
      type: payload.type 
    });

  } catch (error) {
    logger.error("Error in POST /webhooks/printful:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

async function handlePackageShipped(
  orderModuleService: any,
  order: any,
  payload: PrintfulWebhookPayload,
  logger: any
) {
  if (!payload.data.shipment) return;

  const shipment = payload.data.shipment;
  
  logger.info(`Updating order ${order.id} with shipping info: ${shipment.tracking_number}`);

  // Update order metadata with tracking information
  await orderModuleService.updateOrders(order.id, {
    metadata: {
      ...order.metadata,
      printful_tracking_number: shipment.tracking_number,
      printful_tracking_url: shipment.tracking_url,
      printful_carrier: shipment.carrier,
      printful_service: shipment.service,
      printful_shipped_at: shipment.shipped_at,
      printful_ship_date: shipment.ship_date
    }
  });

  // TODO: Create fulfillment record in Medusa
  // This would require creating a fulfillment with tracking info
}

async function handlePackageReturned(
  orderModuleService: any,
  order: any,
  payload: PrintfulWebhookPayload,
  logger: any
) {
  logger.info(`Order ${order.id} package was returned`);

  await orderModuleService.updateOrders(order.id, {
    metadata: {
      ...order.metadata,
      printful_status: 'returned',
      printful_returned_at: Date.now()
    }
  });

  // TODO: Handle return logic - create return record, update inventory, etc.
}

async function handleOrderFailed(
  orderModuleService: any,
  order: any,
  payload: PrintfulWebhookPayload,
  logger: any
) {
  logger.error(`Order ${order.id} failed in Printful`);

  await orderModuleService.updateOrders(order.id, {
    metadata: {
      ...order.metadata,
      printful_status: 'failed',
      printful_failed_at: Date.now(),
      printful_failure_reason: payload.data.order?.status || 'unknown'
    }
  });

  // TODO: Handle failure logic - notify admin, attempt retry, etc.
}

async function handleOrderCanceled(
  orderModuleService: any,
  order: any,
  payload: PrintfulWebhookPayload,
  logger: any
) {
  logger.info(`Order ${order.id} was canceled in Printful`);

  await orderModuleService.updateOrders(order.id, {
    metadata: {
      ...order.metadata,
      printful_status: 'canceled',
      printful_canceled_at: Date.now()
    }
  });

  // TODO: Handle cancellation logic - update order status, refund if needed, etc.
}