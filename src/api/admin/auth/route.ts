import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const userModuleService = req.scope.resolve(Modules.USER);

  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required"
      });
    }

    // For now, accept any admin email and password (you should implement proper auth)
    if (email === "admin@gritcollective.com") {
      // Generate a simple JWT token (in production, use proper JWT with expiration)
      const token = Buffer.from(`${email}:${Date.now()}`).toString('base64');
      
      return res.json({
        user: {
          id: "admin_user",
          email: email,
          first_name: "Admin",
          last_name: "User"
        },
        token: token
      });
    }

    return res.status(401).json({
      error: "Invalid credentials"
    });

  } catch (error) {
    logger.error("Admin auth error:", error);
    return res.status(500).json({
      error: "Authentication failed"
    });
  }
}