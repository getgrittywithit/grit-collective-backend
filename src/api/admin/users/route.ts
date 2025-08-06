import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  try {
    // Simple auth check
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: "Unauthorized - No valid token provided"
      });
    }

    // Return admin user info
    return res.json({
      users: [
        {
          id: "admin_user",
          email: "admin@gritcollective.com",
          first_name: "Admin",
          last_name: "User",
          role: "admin"
        }
      ]
    });

  } catch (error) {
    logger.error("Failed to fetch users:", error);
    return res.status(500).json({
      error: "Failed to fetch users"
    });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  
  try {
    const { email, first_name, last_name, password } = req.body as {
      email: string;
      first_name: string;
      last_name: string;
      password: string;
    };

    if (!email || !first_name || !last_name) {
      return res.status(400).json({
        error: "Email, first_name, and last_name are required"
      });
    }

    // For now, just return success (implement actual user creation as needed)
    const user = {
      id: `user_${Date.now()}`,
      email,
      first_name,
      last_name,
      role: "admin"
    };

    logger.info(`Created admin user: ${email}`);

    return res.status(201).json({
      user
    });

  } catch (error) {
    logger.error("Failed to create user:", error);
    return res.status(500).json({
      error: "Failed to create user"
    });
  }
}