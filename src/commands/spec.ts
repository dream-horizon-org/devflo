import { Command } from "commander";
import { runBundledOpenSpec } from "../utils/openspec.js";

export function registerSpecCommand(program: Command): void {
  program
    .command("spec")
    .description(
      "Run bundled OpenSpec CLI commands (passthrough). Usage: daisdlc spec <openspec-args...>",
    )
    .allowUnknownOption()
    .allowExcessArguments()
    .helpOption(false)
    .action((_opts: unknown, cmd: Command) => {
      const args = cmd.args;
      if (args.length === 0) {
        console.log(
          "Usage: daisdlc spec <command> [options]\n\n" +
            "Forwards all arguments to the bundled OpenSpec CLI.\n\n" +
            "Examples:\n" +
            "  daisdlc spec init --tools none\n" +
            "  daisdlc spec change create <name>\n" +
            "  daisdlc spec change generate-templates <name>\n" +
            "  daisdlc spec validate\n" +
            "  daisdlc spec status --json\n" +
            "  daisdlc spec change archive <name>\n\n" +
            "Run 'daisdlc spec --help' to see all available OpenSpec commands.",
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
