import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import { config } from "@/api/config";

const app = express();

app.use(helmet());
app.use(cors({ origin: config.security.corsOrigin }));
app.use(
  rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    limit: config.security.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

export { app };
