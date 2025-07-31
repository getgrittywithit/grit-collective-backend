import { Module } from "@medusajs/framework/utils";
import PrintfulService from "./service";

export const PRINTFUL_MODULE = "printfulService";

export default Module(PRINTFUL_MODULE, {
  service: PrintfulService,
});

export * from "./types";
export { default as PrintfulService } from "./service";