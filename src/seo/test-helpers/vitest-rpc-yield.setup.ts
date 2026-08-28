import { afterEach } from "vitest";

/** Lets Vitest worker RPC responses flush between tests after long sync I/O. */
afterEach(async () => {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
});
