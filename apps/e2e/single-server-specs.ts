/**
 * The specs that run alone under `browser.config.ts`, against one server and its
 * own baseURL.
 *
 * One list, imported by both configs, because they need it in opposite senses:
 * `browser.config.ts` matches on it and `playwright.config.ts` ignores it. Two
 * copies is two chances to add a spec to one and not the other — which lands as
 * either a spec that never runs or a spec collected by the four-server rig,
 * where there is no baseURL and every `page.goto` throws.
 */
export const SINGLE_SERVER_SPECS =
  /(position|overlay|anchored|reduced-motion|toast|skeleton|navigation|data|nesting|numeric|confirm|form|date|tree|watermark)\.spec\.ts$/;
