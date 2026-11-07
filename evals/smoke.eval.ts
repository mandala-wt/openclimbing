import { defineEval } from "eve/evals";
import { includes } from "eve/evals/expect";

export default defineEval({
  description:
    "Agent erkennt, dass er der Kletterglück/OpenClimbing-Entwicklungshelfer ist.",
  async test(t) {
    const turn = await t.send(
      "Wer bist du und wofür bist du da? Antworte kurz.",
    );
    t.succeeded();
    t.check(turn.reply, includes("Kletter"));
  },
});
