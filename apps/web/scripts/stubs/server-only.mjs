/**
 * Stand-in for the `server-only` marker package.
 *
 * Next resolves that specifier itself, to a module that fails the build if a
 * client component ever imports it. Under `node --test` there is no bundler to
 * do that, and the guarantee is a build-time one anyway, so the module is
 * simply empty here.
 */
export {};
