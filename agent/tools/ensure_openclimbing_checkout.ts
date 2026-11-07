import { defineTool } from "eve/tools";
import { z } from "zod";

const REPO_URL = "https://github.com/mandala-wt/openclimbing.git";
const TARGET = "openclimbing";

export default defineTool({
  description:
    "Stellt sicher, dass der OpenClimbing/Kletterglück-App-Code unter /workspace/openclimbing liegt. Vor jedem Lesen oder Ändern der App aufrufen.",
  inputSchema: z.object({
    refresh: z
      .boolean()
      .optional()
      .describe(
        "Wenn true, holt aktuelle master-Änderungen per fetch/pull (ohne lokale Arbeit zu verwerfen).",
      ),
  }),
  async execute({ refresh }, ctx) {
    const sandbox = await ctx.getSandbox();

    const exists = await sandbox.run({
      command: `test -d ${TARGET}/.git && echo yes || echo no`,
    });

    if (exists.stdout.trim() !== "yes") {
      const clone = await sandbox.run({
        command: `git clone --depth 1 --branch master ${REPO_URL} ${TARGET}`,
      });
      if (clone.exitCode !== 0) {
        throw new Error(clone.stderr || clone.stdout || "git clone failed");
      }
      return {
        path: `/workspace/${TARGET}`,
        action: "cloned",
        repo: REPO_URL,
      };
    }

    if (refresh) {
      const update = await sandbox.run({
        command: `cd ${TARGET} && git fetch origin master && git status -sb`,
      });
      if (update.exitCode !== 0) {
        throw new Error(update.stderr || update.stdout || "git fetch failed");
      }
      return {
        path: `/workspace/${TARGET}`,
        action: "refreshed",
        status: update.stdout.trim(),
      };
    }

    const status = await sandbox.run({
      command: `cd ${TARGET} && git status -sb && git rev-parse --short HEAD`,
    });

    return {
      path: `/workspace/${TARGET}`,
      action: "already_present",
      status: status.stdout.trim(),
    };
  },
});
