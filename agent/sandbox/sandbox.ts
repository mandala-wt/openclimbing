import { DefaultSandbox, defineSandbox } from "eve/sandbox";

export const environment = DefaultSandbox.environment({
  prepare: async (sandbox) => {
    const result = await sandbox.run({
      command:
        "command -v git >/dev/null && command -v gh >/dev/null || true",
    });
    if (result.exitCode !== 0) {
      throw new Error(result.stderr || "sandbox prepare failed");
    }
  },
});

export default defineSandbox(() => environment.open());
