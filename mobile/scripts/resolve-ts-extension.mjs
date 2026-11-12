/**
 * Node's type-stripping loader does not resolve extensionless TypeScript
 * imports. The app bundle and Deno use extensionless specifiers; this hook
 * lets the post-export injector follow the same graph.
 */

export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    !specifier.endsWith(".ts") &&
    !specifier.endsWith(".js") &&
    !specifier.endsWith(".mjs") &&
    !specifier.endsWith(".json")
  ) {
    return nextResolve(`${specifier}.ts`, context);
  }
  return nextResolve(specifier, context);
}
