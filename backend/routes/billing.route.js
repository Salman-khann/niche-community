import express from "express";
import {
	createCheckoutSession,
	verifyCheckoutSession,
	getSubscriptionStatus,
	createPortalSession,
	setAutoRenewal,
	getInvoices,
} from "../controllers/billing.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.post("/create-checkout-session", verifyToken, createCheckoutSession);
router.get("/verify-session", verifyToken, verifyCheckoutSession);
router.get("/subscription", verifyToken, getSubscriptionStatus);
router.post("/portal-session", verifyToken, createPortalSession);
router.post("/auto-renewal", verifyToken, setAutoRenewal);
router.get("/invoices", verifyToken, getInvoices);

export default router;
