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

    const { offset = 0, limit = 20, status } = req.query;

    logger.info(`Fetching Printful orders: offset=${offset}, limit=${limit}, status=${status}`);

    try {
      const printfulService: any = req.scope.resolve("printfulService");
      
      // Test connection first
      const connectionTest = await printfulService.testConnection();
      if (!connectionTest.success) {
        return res.status(503).json({
          success: false,
          error: "Printful not connected",
          details: connectionTest.error?.message || "Connection failed"
        });
      }

      // Get orders from Printful
      const result = await printfulService.getOrders(status?.toString(), Number(limit), Number(offset));
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get orders');
      }
      
      const orders = result.data || [];

      logger.info(`Retrieved ${orders?.length || 0} Printful orders`);

      return res.json({
        success: true,
        orders: orders || [],
        pagination: {
          offset: Number(offset),
          limit: Number(limit),
          count: orders?.length || 0,
          has_more: (orders?.length || 0) >= Number(limit)
        },
        filters: {
          status
        },
        available_statuses: [
          'draft',
          'pending',
          'failed',
          'canceled',
          'onhold',
          'inprocess',
          'partial',
          'fulfilled'
        ]
      });

    } catch (serviceError) {
      logger.error("Printful orders error:", serviceError);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch Printful orders",
        details: serviceError instanceof Error ? serviceError.message : "Unknown error"
      });
    }

  } catch (error) {
    logger.error("Printful orders request failed:", error);
    return res.status(500).json({
      success: false,
      error: "Printful orders request failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
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

    const { medusa_order_id, action = 'create_draft' } = (req.body as any) || {};

    if (!medusa_order_id) {
      return res.status(400).json({
        success: false,
        error: "medusa_order_id is required"
      });
    }

    logger.info(`Printful order action: ${action} for order ${medusa_order_id}`);

    try {
      const printfulService: any = req.scope.resolve("printfulService");
      
      // Test connection first
      const connectionTest = await printfulService.testConnection();
      if (!connectionTest.success) {
        return res.status(503).json({
          success: false,
          error: "Printful not connected",
          details: connectionTest.error?.message || "Connection failed"
        });
      }

      let result;
      
      switch (action) {
        case 'create_draft':
          result = await printfulService.createDraftOrder(medusa_order_id);
          break;
          
        case 'confirm':
          result = await printfulService.confirmOrder(medusa_order_id);
          break;
          
        case 'cancel':
          result = await printfulService.cancelOrder(medusa_order_id);
          break;
          
        default:
          return res.status(400).json({
            success: false,
            error: `Unknown action: ${action}`,
            available_actions: ['create_draft', 'confirm', 'cancel']
          });
      }

      logger.info(`Printful order ${action} completed: ${JSON.stringify(result)}`);

      return res.json({
        success: true,
        action,
        medusa_order_id,
        printful_order_id: result?.id || null,
        result,
        processed_at: new Date().toISOString()
      });

    } catch (serviceError) {
      logger.error(`Printful order ${action} error:`, serviceError);
      return res.status(500).json({
        success: false,
        error: `Printful order ${action} failed`,
        details: serviceError instanceof Error ? serviceError.message : "Unknown error"
      });
    }

  } catch (error) {
    logger.error("Printful order action failed:", error);
    return res.status(500).json({
      success: false,
      error: "Printful order action failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}