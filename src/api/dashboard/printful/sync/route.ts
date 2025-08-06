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

    const { sync_type = 'all', product_ids = [] } = (req.body as any) || {};

    logger.info(`Printful sync requested: type=${sync_type}, products=${product_ids.length}`);

    // Try to resolve Printful service
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

      let syncResult;
      
      switch (sync_type) {
        case 'products':
          logger.info("Syncing Printful products...");
          syncResult = await printfulService.syncProducts(product_ids);
          break;
          
        case 'store_info':
          logger.info("Syncing Printful store info...");
          syncResult = await printfulService.syncStoreInfo();
          break;
          
        case 'all':
        default:
          logger.info("Full Printful sync...");
          syncResult = await printfulService.fullSync();
          break;
      }

      logger.info(`Printful sync completed: ${JSON.stringify(syncResult)}`);

      return res.json({
        success: true,
        sync_type,
        result: syncResult,
        synced_at: new Date().toISOString(),
        message: `Printful ${sync_type} sync completed successfully`
      });

    } catch (serviceError) {
      logger.error("Printful sync error:", serviceError);
      return res.status(500).json({
        success: false,
        error: "Printful sync failed",
        details: serviceError instanceof Error ? serviceError.message : "Unknown sync error"
      });
    }

  } catch (error) {
    logger.error("Printful sync request failed:", error);
    return res.status(500).json({
      success: false,
      error: "Printful sync request failed",
      details: error instanceof Error ? error.message : "Unknown error"
    });
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

    logger.info("Getting Printful sync status...");

    // Return sync status and available sync options
    return res.json({
      available_syncs: [
        {
          type: 'all',
          name: 'Full Sync',
          description: 'Sync all products, store info, and settings',
          estimated_time: '2-5 minutes'
        },
        {
          type: 'products', 
          name: 'Products Only',
          description: 'Sync product catalog from Printful',
          estimated_time: '1-3 minutes'
        },
        {
          type: 'store_info',
          name: 'Store Info',
          description: 'Update store settings and configuration',
          estimated_time: '< 1 minute'
        }
      ],
      last_sync: null, // TODO: Track last sync times
      sync_in_progress: false, // TODO: Track active syncs
      recommendations: [
        "Run full sync after connecting Printful",
        "Sync products when adding new items to catalog",
        "Regular syncs ensure inventory accuracy"
      ]
    });

  } catch (error) {
    logger.error("Failed to get sync status:", error);
    return res.status(500).json({
      error: "Failed to get sync status",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
}