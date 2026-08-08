/**
 * Monaco editor initialization helper.
 *
 * Monaco (all language grammars + TS/JSON/CSS/HTML language workers) is loaded
 * by `@monaco-editor/react`'s built-in loader. To keep the bundle self-contained
 * and avoid vendoring the multi-MB Monaco ESM into every student build, the loader
 * resolves the editor from a pinned, reliable CDN URL. This is the same model
 * used by CodePen / CodeSandbox for Monaco and adds no build-time friction.
 *
 * `initMonaco(monaco)` is called from the editor's `beforeMount` callback and:
 *   1. registers the platform dark/light theme (tuned to the brand palette)
 *   2. configures language features (brackets, comments, folding, snippets)
 *   3. enables JS/TS on-the-fly diagnostics (IntelliSense + error squiggles)
 *
 * It is idempotent and safe to call on every mount.
 */
import { registerMonacoThemes, configureMonacoLanguages, configureJsLanguageService } from "./utils/coding/monacoSetup";

let lastInstance = null;

export function initMonaco(monacoInstance) {
  if (!monacoInstance) return;
  if (lastInstance === monacoInstance) return;
  lastInstance = monacoInstance;

  registerMonacoThemes(monacoInstance);
  configureMonacoLanguages(monacoInstance);
  configureJsLanguageService(monacoInstance);
}

export default initMonaco;
