import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

function isValidAuthToken(token: string): boolean {
  try {
    // Decode the base64 token we generate in /auth
    const decoded = Buffer.from(token, 'base64').toString();
    return decoded.includes('admin@gritcollective.com');
  } catch {
    return false;
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const customerModuleService = req.scope.resolve(Modules.CUSTOMER);

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

    const { offset = 0, limit = 50 } = req.query;

    logger.info(`Fetching customers: offset=${offset}, limit=${limit}`);

    const customers = await customerModuleService.listCustomers(
      {},
      {
        skip: Number(offset),
        take: Number(limit),
        relations: [
          "addresses"
        ]
      }
    );

    const totalCustomers = await customerModuleService.listCustomers({}, { take: null });

    return res.json({
      customers,
      count: totalCustomers.length,
      offset: Number(offset),
      limit: Number(limit)
    });

  } catch (error) {
    logger.error("Failed to fetch customers:", error);
    return res.status(500).json({
      error: "Failed to fetch customers",
      details: error.message
    });
  }
}