
import app from "./app";
import { logger } from "./lib/logger";

const port = Number(process.env.PORT) || 3000;

app.listen(port, '0.0.0.0', () => {
  logger.info({ port }, "Server listening");
});

