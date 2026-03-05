import { Command } from "commander";
import { runBundledOpenSpec } from "../utils/openspec.js";

export function registerSpecCommand(program: Command): void {
  program
    .command("spec")
    .description(
      "Run bundled OpenSpec CLI commands (passthrough). Usage: devflo spec <openspec-args...>",
    )
    .allowUnknownOption()
    .allowExcessArguments()
    .helpOption(false)
    .action((_opts: unknown, cmd: Command) => {
      const args = cmd.args;
      if (args.length === 0) {
        console.log(
          "Usage: devflo spec <command> [options]\n\n" +
            "Forwards all arguments to the bundled OpenSpec CLI.\n\n" +
            "Examples:\n" +
            "  devflo spec init --tools none\n" +
            "  devflo spec change create <name>\n" +
            "  devflo spec change generate-templates <name>\n" +
            "  devflo spec validate\n" +
            "  devflo spec status --json\n" +
            "  devflo spec change archive <name>\n\n" +
            "Run 'devflo spec --help' to see all available OpenSpec commands.",
        );
        return;
      }

      if (args.length === 1 && args[0] === "--help") {
        runBundledOpenSpec(["--help"]);
        return;
      }

      runBundledOpenSpec(args);
    });
}
