import { test, expect } from "@playwright/test";

/**
 * Which of our own CSS rules reach a component when it is nested.
 *
 * `data-part` is a shared namespace — thirty-three names are used by more than
 * one component, `label` by twelve and `item` by ten — so a loose descendant
 * rule on anything that holds arbitrary content reaches whatever a consumer
 * puts inside it.
 *
 * Matching *selectors* rather than computed style, because computed style
 * cannot tell a leak from ordinary inheritance: an Alert setting 14px for
 * everything it holds is correct, and a rule reaching in to set the same 14px
 * on one part is not. Comparing the two lists says exactly which rules matched
 * an element in one position and not the other.
 */
const foreignRules = (page: import("@playwright/test").Page, id: string, held: string) =>
  page.evaluate(
    ({ scopedId, heldScope }) => {
      const selectorsFor = (el: Element) => {
        const own = el.closest("[data-scope]")?.getAttribute("data-scope");
        const hits: string[] = [];
        for (const sheet of Array.from(document.styleSheets)) {
          let rules: CSSRule[];
          try {
            rules = Array.from(sheet.cssRules);
          } catch {
            continue; // cross-origin, not ours
          }
          const walk = (list: CSSRule[]) => {
            for (const rule of list) {
              if (rule instanceof CSSGroupingRule) walk(Array.from(rule.cssRules));
              if (!(rule instanceof CSSStyleRule)) continue;
              for (const selector of rule.selectorText.split(",")) {
                const trimmed = selector.trim();
                if (!trimmed.includes("[data-scope=")) continue;
                // Only rules belonging to some OTHER component can be a leak.
                const owner = /\[data-scope="?([a-z-]+)"?\]/.exec(trimmed)?.[1];
                if (owner === own) continue;
                try {
                  if (el.matches(trimmed)) hits.push(trimmed);
                } catch {
                  /* :has and friends the browser will not evaluate here */
                }
              }
            }
          };
          walk(rules);
        }
        return hits.sort();
      };

      // Only the held component's own subtree. The nested side legitimately has
      // extra elements — a Result draws its own icon, an Alert its own — and
      // counting those makes every container look like it leaks into itself.
      const root = document.getElementById(scopedId)?.querySelector(`[data-scope="${heldScope}"]`);
      if (!root) return ["MISSING ROOT"];
      return Array.from(root.querySelectorAll("[data-part]")).flatMap(el => {
        const scope = el.closest("[data-scope]")?.getAttribute("data-scope");
        const part = el.getAttribute("data-part");
        return selectorsFor(el).map(selector => `${scope}/${part} <- ${selector}`);
      });
    },
    { scopedId: id, heldScope: held }
  );

const PAIRS = [
  ["card-list", "list", "a List inside a Card"],
  ["card-desc", "descriptions", "a Descriptions inside a Card"],
  ["result-stat", "statistic", "a Statistic inside a Result"],
  ["alert-steps", "steps", "a Steps inside an Alert"],
  ["skeleton-stat", "statistic", "a Statistic inside a Skeleton.Node"],
  ["empty-list", "list", "a List inside an Empty"],
  ["button-result", "result", "a Result inside a Button"],
  // The four newest components, both directions: holding someone else's parts,
  // and having their own parts held. Each was authored knowing only its own
  // slice of the shared `data-part` vocabulary.
  ["splitter-list", "list", "a List inside a Splitter.Panel"],
  ["watermark-desc", "descriptions", "a Descriptions inside a Watermark"],
  ["dragger-list", "list", "a List inside an Upload.Dragger"],
  ["card-splitter", "splitter", "a Splitter inside a Card"],
  ["card-upload", "upload", "an Upload inside a Card"],
  ["card-cascader", "cascader", "a Cascader inside a Card"],
] as const;

for (const [id, held, description] of PAIRS) {
  test(`no rule reaches into ${description}`, async ({ page }) => {
    await page.goto("/nesting.html");
    // Both sides present before either is measured: two empty lists agree with
    // each other, and a harness that failed to render would report success.
    await expect(page.locator(`#${id}-in [data-part]`).first()).toBeAttached();
    await expect(page.locator(`#${id}-out [data-part]`).first()).toBeAttached();

    const inside = await foreignRules(page, `${id}-in`, held);
    const outside = await foreignRules(page, `${id}-out`, held);
    expect(inside).not.toEqual(["MISSING ROOT"]);

    // The container's own rules are allowed to match the container. What must
    // not differ is what reaches the component *it holds*, which is why the
    // comparison is against the identical tree rendered loose.
    expect(inside).toEqual(outside);
  });
}

test("keeps a Button's own rules when it is stamped as another component's part", async ({
  page,
}) => {
  await page.goto("/nesting.html");
  const icon = page.locator('#stamped-in [data-part="close-trigger"] svg');
  await expect(icon).toHaveCount(1);

  const measured = await icon.evaluate(el => {
    const style = getComputedStyle(el);
    return {
      size: Math.round(el.getBoundingClientRect().height * 100) / 100,
      em: Math.round(Number.parseFloat(style.fontSize) * 100) / 100,
    };
  });

  // Against its own `1em`, not against a loose Button — the two sit in
  // different font contexts, so comparing them measures inheritance rather
  // than the rule. `button.css` sizes a composed icon at `1em`; when its rule
  // stops matching, `icon.css` supplies 1.25rem instead and the glyph jumps.
  //
  // The rule stops matching over an attribute, not a combinator: Alert renders
  // its dismiss control as a Button with its own part stamped on it, and
  // consumer attributes spread last — so the stamped name REPLACES `root`.
  // `icon.css` and `button-v1.css` each already carry a note about this.
  expect(measured.size).toBe(measured.em);
});
