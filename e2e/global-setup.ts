import { seedE2E } from "./seed";

export default async function globalSetup() {
  await seedE2E();
}
