import { adminRouter } from "./router/admin";
import { authRouter } from "./router/auth";
import { omnidatRouter } from "./router/omnidat";
import { postRouter } from "./router/post";
import { settingsRouter } from "./router/settings";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  admin: adminRouter,
  auth: authRouter,
  omnidat: omnidatRouter,
  post: postRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
