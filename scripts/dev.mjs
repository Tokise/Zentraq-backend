import { spawn } from "node:child_process";
import process from "node:process";

const currentServices = [
  "@zentraq/api-gateway",
  "@zentraq/appointment-service",
  "@zentraq/inventory-service",
  "@zentraq/notification-service",
  "@zentraq/reporting-service",
  "@zentraq/ai-service",
];

const legacyServices = [
  "@zentraq/identity-service",
  "@zentraq/clinical-service",
];

// Runs pnpm through the exact CLI that invoked this workspace script.
function runPnpm(pnpmCli, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      pnpmCli,
      args,
      { stdio: "inherit" },
    );

    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolve({ code, signal });
    });
  });
}

// Builds shared code before starting either the current or rollback services.
async function main() {
  const pnpmCli = process.env.npm_execpath;

  if (!pnpmCli) {
    throw new Error("Run this launcher through pnpm so npm_execpath is set.");
  }

  const sharedBuild = await runPnpm(
    pnpmCli,
    ["--filter", "@zentraq/shared", "build"],
  );

  if (sharedBuild.code !== 0) {
    process.exitCode = sharedBuild.code ?? 1;
    return;
  }

  const services = process.argv.includes("--legacy")
    ? legacyServices
    : currentServices;
  const filters = services.flatMap((service) => ["--filter", service]);
  const development = await runPnpm(
    pnpmCli,
    [...filters, "--parallel", "-r", "dev"],
  );

  process.exitCode = development.code ?? (development.signal ? 130 : 1);
}

await main();
