import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import healthRouter from "./health";
import staytrackRouter from "./staytrack";

const router: IRouter = Router();

router.use(healthRouter);
const requireAuth: RequestHandler = (req, res, next) => {
  const auth = getAuth(req);
  if (!auth.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};
router.use(requireAuth, staytrackRouter);

export default router;
