import {
  createWorkflow,
  WorkflowResponse,
  createStep,
  StepResponse,
} from "@medusajs/framework/workflows-sdk";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import PrintfulService from "../modules/printful/service";

// Input type for the workflow
interface CreatePrintfulOrderInput {
  medusa_order_id: string;
  confirm_immediately?: boolean;
}

interface CreatePrintfulOrderOutput {
  printful_order_id: string;
  printful_external_id: string;
  confirmed: boolean;
  success: boolean;
  error?: string;
}

// Step 1: Create Printful Order
const createPrintfulOrderStep = createStep(
  "create-printful-order",
  async (input: CreatePrintfulOrderInput, { container }) => {
    const printfulService: PrintfulService = container.resolve("printfulService");
    const orderModuleService = container.resolve(Modules.ORDER);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    try {
      // Get the Medusa order
      const order = await orderModuleService.retrieveOrder(input.medusa_order_id, {
        relations: ["items", "shipping_address"]
      });

      if (!order) {
        throw new Error(`Order ${input.medusa_order_id} not found`);
      }

      // Check if order already has a Printful order
      const existingPrintfulOrderId = order.metadata?.printful_order_id;
      if (existingPrintfulOrderId) {
        logger.info(`Order ${input.medusa_order_id} already has Printful order ${existingPrintfulOrderId}`);
        
        return new StepResponse({
          printful_order_id: existingPrintfulOrderId as string,
          printful_external_id: order.metadata?.printful_external_id as string,
          confirmed: false,
          success: true,
          already_exists: true
        });
      }

      // Create Printful order
      const result = await printfulService.createOrder(order);

      if (!result.success) {
        throw new Error(`Failed to create Printful order: ${result.error?.message}`);
      }

      const printfulOrder = result.data!;

      return new StepResponse({
        printful_order_id: printfulOrder.id.toString(),
        printful_external_id: printfulOrder.external_id,
        confirmed: false,
        success: true
      });

    } catch (error) {
      logger.error(`Error creating Printful order for ${input.medusa_order_id}:`, error);
      throw error;
    }
  },
  async (output: CreatePrintfulOrderOutput, { container }) => {
    // Compensation: Cancel the Printful order if something fails later
    if (output.success && !output.already_exists) {
      const printfulService: PrintfulService = container.resolve("printfulService");
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

      try {
        await printfulService.cancelOrder(output.printful_order_id);
        logger.info(`Compensated: Canceled Printful order ${output.printful_order_id}`);
      } catch (error) {
        logger.error(`Failed to compensate Printful order ${output.printful_order_id}:`, error);
      }
    }
  }
);

// Step 2: Update Medusa Order Metadata
const updateOrderMetadataStep = createStep(
  "update-order-metadata",
  async (
    input: { 
      medusa_order_id: string; 
      printful_order_id: string; 
      printful_external_id: string;
    },
    { container }
  ) => {
    const orderModuleService = container.resolve(Modules.ORDER);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    try {
      const order = await orderModuleService.retrieveOrder(input.medusa_order_id);

      await orderModuleService.updateOrders(input.medusa_order_id, {
        metadata: {
          ...order.metadata,
          printful_order_id: input.printful_order_id,
          printful_external_id: input.printful_external_id,
          printful_created_at: Date.now()
        }
      });

      logger.info(`Updated order ${input.medusa_order_id} with Printful order ID ${input.printful_order_id}`);

      return new StepResponse({
        success: true,
        medusa_order_id: input.medusa_order_id,
        printful_order_id: input.printful_order_id
      });

    } catch (error) {
      logger.error(`Error updating order metadata for ${input.medusa_order_id}:`, error);
      throw error;
    }
  },
  async (output: any, { container }) => {
    // Compensation: Remove Printful metadata from order
    if (output.success) {
      const orderModuleService = container.resolve(Modules.ORDER);
      const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

      try {
        const order = await orderModuleService.retrieveOrder(output.medusa_order_id);
        const { printful_order_id, printful_external_id, printful_created_at, ...cleanMetadata } = order.metadata || {};

        await orderModuleService.updateOrders(output.medusa_order_id, {
          metadata: cleanMetadata
        });

        logger.info(`Compensated: Removed Printful metadata from order ${output.medusa_order_id}`);
      } catch (error) {
        logger.error(`Failed to compensate order metadata for ${output.medusa_order_id}:`, error);
      }
    }
  }
);

// Step 3: Confirm Order (Optional)
const confirmPrintfulOrderStep = createStep(
  "confirm-printful-order",
  async (
    input: { 
      printful_order_id: string; 
      confirm: boolean;
    },
    { container }
  ) => {
    if (!input.confirm) {
      return new StepResponse({
        confirmed: false,
        success: true
      });
    }

    const printfulService: PrintfulService = container.resolve("printfulService");
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    try {
      const result = await printfulService.confirmOrder(input.printful_order_id);

      if (!result.success) {
        throw new Error(`Failed to confirm Printful order: ${result.error?.message}`);
      }

      logger.info(`Confirmed Printful order ${input.printful_order_id} for fulfillment`);

      return new StepResponse({
        confirmed: true,
        success: true,
        printful_order: result.data
      });

    } catch (error) {
      logger.error(`Error confirming Printful order ${input.printful_order_id}:`, error);
      throw error;
    }
  }
);

// Main Workflow
export const createPrintfulOrderWorkflow = createWorkflow(
  "create-printful-order",
  (input: CreatePrintfulOrderInput) => {
    // Step 1: Create the Printful order
    const printfulOrderResult = createPrintfulOrderStep(input);

    // Step 2: Update Medusa order metadata
    const metadataResult = updateOrderMetadataStep({
      medusa_order_id: input.medusa_order_id,
      printful_order_id: printfulOrderResult.printful_order_id,
      printful_external_id: printfulOrderResult.printful_external_id
    });

    // Step 3: Confirm order if requested
    const confirmResult = confirmPrintfulOrderStep({
      printful_order_id: printfulOrderResult.printful_order_id,
      confirm: input.confirm_immediately || false
    });

    return new WorkflowResponse({
      medusa_order_id: input.medusa_order_id,
      printful_order_id: printfulOrderResult.printful_order_id,
      printful_external_id: printfulOrderResult.printful_external_id,
      confirmed: confirmResult.confirmed,
      success: true
    });
  }
);

// Workflow for handling order status updates from webhooks
interface HandleOrderUpdateInput {
  printful_order_id: string;
  medusa_order_id: string;
  webhook_type: string;
  webhook_data: any;
}

const updateOrderStatusStep = createStep(
  "update-order-status",
  async (input: HandleOrderUpdateInput, { container }) => {
    const orderModuleService = container.resolve(Modules.ORDER);
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

    try {
      const order = await orderModuleService.retrieveOrder(input.medusa_order_id);

      // Update metadata based on webhook type
      let statusUpdate: any = {
        ...order.metadata,
        printful_last_webhook: input.webhook_type,
        printful_last_update: Date.now()
      };

      switch (input.webhook_type) {
        case 'package_shipped':
          statusUpdate.printful_status = 'shipped';
          if (input.webhook_data.shipment) {
            statusUpdate.printful_tracking_number = input.webhook_data.shipment.tracking_number;
            statusUpdate.printful_tracking_url = input.webhook_data.shipment.tracking_url;
            statusUpdate.printful_carrier = input.webhook_data.shipment.carrier;
          }
          break;

        case 'package_returned':
          statusUpdate.printful_status = 'returned';
          break;

        case 'order_failed':
          statusUpdate.printful_status = 'failed';
          break;

        case 'order_canceled':
          statusUpdate.printful_status = 'canceled';
          break;
      }

      await orderModuleService.updateOrders(input.medusa_order_id, {
        metadata: statusUpdate
      });

      logger.info(`Updated order ${input.medusa_order_id} status based on webhook ${input.webhook_type}`);

      return new StepResponse({
        success: true,
        updated_status: statusUpdate.printful_status
      });

    } catch (error) {
      logger.error(`Error updating order status for ${input.medusa_order_id}:`, error);
      throw error;
    }
  }
);

export const handleOrderUpdateWorkflow = createWorkflow(
  "handle-printful-order-update",
  (input: HandleOrderUpdateInput) => {
    const updateResult = updateOrderStatusStep(input);

    return new WorkflowResponse({
      medusa_order_id: input.medusa_order_id,
      printful_order_id: input.printful_order_id,
      webhook_type: input.webhook_type,
      updated_status: updateResult.updated_status,
      success: true
    });
  }
);