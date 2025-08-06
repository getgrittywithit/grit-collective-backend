import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

export default async function createAdminUser({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const userModuleService = container.resolve(Modules.USER);

  try {
    // Check if admin user already exists
    const existingUsers = await userModuleService.listUsers({
      email: "admin@gritcollective.com"
    });

    if (existingUsers.length > 0) {
      logger.info("Admin user already exists with email: admin@gritcollective.com");
      return;
    }

    // Create admin user
    const adminUser = await userModuleService.createUsers({
      email: "admin@gritcollective.com",
      first_name: "Admin",
      last_name: "User"
    });

    logger.info(`Created admin user with ID: ${adminUser.id}`);
    logger.info("Admin user email: admin@gritcollective.com");
    logger.info("Please set up authentication via the admin dashboard");

  } catch (error) {
    logger.error("Failed to create admin user:", error);
    throw error;
  }
}