import User from "../models/user.model.js";
import Profile from "../models/profile.model.js";

import Stripe from "stripe";

let stripeClient = undefined;

const resolveStripeClient = () => {
    if (stripeClient) return stripeClient;
    if (!process.env.STRIPE_SECRET_KEY) return null;
    try {
        stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
    } catch (error) {
        console.log("Stripe SDK load error:", error.message);
        stripeClient = null;
    }
    return stripeClient;
};

const PREMIUM_ELIGIBLE_TIERS = new Set(["premium", "enterprise"]);

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "past_due"]);

const getPriceIdForPlan = (plan) => {
    if (plan === "enterprise") return process.env.STRIPE_ENTERPRISE_PRICE_ID || "";
    return process.env.STRIPE_PREMIUM_PRICE_ID || "";
};

const normalizeRequestedPlan = (value) => (value === "enterprise" ? "enterprise" : "premium");

const resolveTierFromSubscription = (subscription, fallbackTier = "premium") => {
    const planMeta = subscription?.metadata?.plan || "";
    if (String(planMeta).toLowerCase().includes("enterprise")) return "enterprise";

    const enterprisePriceId = process.env.STRIPE_ENTERPRISE_PRICE_ID || "";
    const itemPriceIds = (subscription?.items?.data || []).map((item) => item?.price?.id).filter(Boolean);
    if (enterprisePriceId && itemPriceIds.includes(enterprisePriceId)) return "enterprise";

    return fallbackTier === "enterprise" ? "enterprise" : "premium";
};

const getSubscriptionSnapshot = async (stripe, profile) => {
    if (!profile?.stripeSubscriptionId) return null;
    try {
        const subscription = await stripe.subscriptions.retrieve(profile.stripeSubscriptionId);
        const currentPeriodEndMs = subscription.current_period_end ? subscription.current_period_end * 1000 : null;
        return {
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: subscription.customer || profile.stripeCustomerId || null,
            status: subscription.status || profile.subscriptionStatus || "inactive",
            cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
            currentPeriodEnd: currentPeriodEndMs ? new Date(currentPeriodEndMs).toISOString() : null,
            tier: resolveTierFromSubscription(subscription, profile.tier),
            plan: resolveTierFromSubscription(subscription, profile.tier) === "enterprise" ? "enterprise-monthly" : "premium-monthly",
        };
    } catch {
        return null;
    }
};

const resolveProfileByStripeEvent = async ({ userId, customerId, subscriptionId }) => {
    if (userId) {
        const profileByUser = await Profile.findOne({ userId });
        if (profileByUser) return profileByUser;
    }
    if (subscriptionId) {
        const profileBySub = await Profile.findOne({ stripeSubscriptionId: subscriptionId });
        if (profileBySub) return profileBySub;
    }
    if (customerId) {
        const profileByCustomer = await Profile.findOne({ stripeCustomerId: customerId });
        if (profileByCustomer) return profileByCustomer;
    }
    return null;
};

// ── Create Stripe Checkout Session (monthly premium subscription) ──────────
export const createCheckoutSession = async (req, res) => {
    try {
        if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_PREMIUM_PRICE_ID) {
            return res.status(500).json({
                success: false,
                message: "Stripe is not configured on the server",
            });
        }
        const stripe = resolveStripeClient();
        if (!stripe) {
            return res.status(500).json({
                success: false,
                message: "Stripe SDK is unavailable or STRIPE_SECRET_KEY is missing",
            });
        }

        const requestedPlan = normalizeRequestedPlan(req.body?.plan);
        const selectedPriceId = getPriceIdForPlan(requestedPlan);
        if (!selectedPriceId) {
            return res.status(400).json({
                success: false,
                message: requestedPlan === "enterprise"
                    ? "Enterprise plan is not configured yet"
                    : "Premium plan is not configured",
            });
        }

        const user = await User.findById(req.userId).select("email").lean();
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        let profile = await Profile.findOne({ userId: req.userId });
        if (!profile) {
            profile = await Profile.create({ userId: req.userId });
        }

        if (PREMIUM_ELIGIBLE_TIERS.has(profile.tier)) {
            return res.status(400).json({
                success: false,
                message: "You already have an active premium plan",
            });
        }

        let customerId = profile.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: { userId: String(req.userId) },
            });
            customerId = customer.id;
            profile.stripeCustomerId = customerId;
            await profile.save();
        }

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [
                {
                    price: selectedPriceId,
                    quantity: 1,
                },
            ],
            client_reference_id: String(req.userId),
            success_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/upgrade/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/upgrade/cancel`,
            metadata: {
                userId: String(req.userId),
                plan: `${requestedPlan}-monthly`,
            },
            subscription_data: {
                metadata: {
                    userId: String(req.userId),
                    plan: `${requestedPlan}-monthly`,
                },
            },
        });

        return res.status(200).json({
            success: true,
            url: session.url,
            sessionId: session.id,
        });
    } catch (error) {
        console.log("Error in createCheckoutSession:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Verify Checkout Session (fallback for when webhooks are unavailable) ────
export const verifyCheckoutSession = async (req, res) => {
    try {
        const { session_id } = req.query;
        if (!session_id) {
            return res.status(400).json({ success: false, message: "session_id is required" });
        }

        const stripe = resolveStripeClient();
        if (!stripe) {
            return res.status(500).json({ success: false, message: "Stripe is not configured" });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== "paid") {
            return res.status(400).json({
                success: false,
                message: "Payment has not been completed",
                paymentStatus: session.payment_status,
            });
        }

        // Find the profile by userId from the session metadata or by the logged-in user
        const userId = session.client_reference_id || session.metadata?.userId || req.userId;
        let profile = await Profile.findOne({ userId });
        if (!profile) {
            profile = await Profile.create({ userId });
        }

        // Upgrade to premium
        const planMeta = (session.metadata?.plan || "").toLowerCase();
        profile.tier = planMeta.includes("enterprise") ? "enterprise" : "premium";
        profile.subscriptionStatus = "active";
        profile.stripeCustomerId = session.customer || profile.stripeCustomerId || null;
        profile.stripeSubscriptionId = session.subscription || profile.stripeSubscriptionId || null;
        await profile.save();

        return res.status(200).json({
            success: true,
            message: "Subscription activated",
            tier: profile.tier,
        });
    } catch (error) {
        console.log("Error in verifyCheckoutSession:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ── Stripe Webhook (must receive raw request body) ─────────────────────────
export const stripeWebhook = async (req, res) => {
    let event;

    try {
        if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
            return res.status(500).send("Stripe webhook is not configured");
        }
        const stripe = resolveStripeClient();
        if (!stripe) {
            return res.status(500).send("Stripe webhook is not configured");
        }

        const signature = req.headers["stripe-signature"];
        if (!signature) {
            return res.status(400).send("Missing Stripe signature");
        }

        event = stripe.webhooks.constructEvent(
            req.body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (error) {
        console.log("Stripe webhook signature verification failed:", error.message);
        return res.status(400).send(`Webhook Error: ${error.message}`);
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object;
                const userId = session.client_reference_id || session.metadata?.userId;
                const customerId = session.customer;
                const subscriptionId = session.subscription;

                const profile = await resolveProfileByStripeEvent({
                    userId,
                    customerId,
                    subscriptionId,
                });
                if (!profile) break;

                profile.stripeCustomerId = customerId || profile.stripeCustomerId || null;
                profile.stripeSubscriptionId = subscriptionId || profile.stripeSubscriptionId || null;
                const planMeta = (session.metadata?.plan || "").toLowerCase();
                profile.tier = planMeta.includes("enterprise") ? "enterprise" : "premium";
                profile.subscriptionStatus = "active";
                await profile.save();
                break;
            }

            case "customer.subscription.updated": {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                const subscriptionId = subscription.id;
                const status = subscription.status || "active";

                const profile = await resolveProfileByStripeEvent({
                    customerId,
                    subscriptionId,
                });
                if (!profile) break;

                profile.stripeCustomerId = customerId || profile.stripeCustomerId || null;
                profile.stripeSubscriptionId = subscriptionId || profile.stripeSubscriptionId || null;
                profile.subscriptionStatus = status;
                profile.tier = ACTIVE_SUBSCRIPTION_STATUSES.has(status)
                    ? resolveTierFromSubscription(subscription, profile.tier)
                    : "free";
                if (profile.tier === "free") profile.stripeSubscriptionId = null;
                await profile.save();
                break;
            }

            case "customer.subscription.deleted": {
                const subscription = event.data.object;
                const customerId = subscription.customer;
                const subscriptionId = subscription.id;

                const profile = await resolveProfileByStripeEvent({
                    customerId,
                    subscriptionId,
                });
                if (!profile) break;

                profile.subscriptionStatus = "canceled";
                profile.tier = "free";
                profile.stripeSubscriptionId = null;
                await profile.save();
                break;
            }

            default:
                break;
        }

        return res.status(200).json({ received: true });
    } catch (error) {
        console.log("Error in stripeWebhook handler:", error);
        return res.status(500).send("Webhook handler failed");
    }
};

export const getSubscriptionStatus = async (req, res) => {
    try {
        const profile = await Profile.findOne({ userId: req.userId }).lean();
        if (!profile) {
            return res.status(200).json({
                success: true,
                subscription: {
                    tier: "free",
                    subscriptionStatus: "inactive",
                    cancelAtPeriodEnd: false,
                    currentPeriodEnd: null,
                    stripeSubscriptionId: null,
                    stripeCustomerId: null,
                    plan: "free",
                },
            });
        }

        const stripe = resolveStripeClient();
        const snapshot = stripe ? await getSubscriptionSnapshot(stripe, profile) : null;
        const subscription = snapshot || {
            tier: profile.tier || "free",
            subscriptionStatus: profile.subscriptionStatus || "inactive",
            cancelAtPeriodEnd: false,
            currentPeriodEnd: null,
            stripeSubscriptionId: profile.stripeSubscriptionId || null,
            stripeCustomerId: profile.stripeCustomerId || null,
            plan: profile.tier === "enterprise" ? "enterprise-monthly" : profile.tier === "premium" ? "premium-monthly" : "free",
        };

        return res.status(200).json({ success: true, subscription });
    } catch (error) {
        console.log("Error in getSubscriptionStatus:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const createPortalSession = async (req, res) => {
    try {
        const stripe = resolveStripeClient();
        if (!stripe) {
            return res.status(500).json({ success: false, message: "Stripe is not configured" });
        }

        const profile = await Profile.findOne({ userId: req.userId }).lean();
        if (!profile?.stripeCustomerId) {
            return res.status(400).json({ success: false, message: "No billing customer found" });
        }

        const portal = await stripe.billingPortal.sessions.create({
            customer: profile.stripeCustomerId,
            return_url: `${process.env.CLIENT_URL || "http://localhost:5173"}/upgrade`,
        });

        return res.status(200).json({ success: true, url: portal.url });
    } catch (error) {
        console.log("Error in createPortalSession:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const setAutoRenewal = async (req, res) => {
    try {
        const { enabled } = req.body || {};
        if (typeof enabled !== "boolean") {
            return res.status(400).json({ success: false, message: "enabled must be a boolean" });
        }

        const stripe = resolveStripeClient();
        if (!stripe) {
            return res.status(500).json({ success: false, message: "Stripe is not configured" });
        }

        const profile = await Profile.findOne({ userId: req.userId });
        if (!profile?.stripeSubscriptionId) {
            return res.status(400).json({ success: false, message: "No active subscription found" });
        }

        const updated = await stripe.subscriptions.update(profile.stripeSubscriptionId, {
            cancel_at_period_end: !enabled,
        });

        profile.subscriptionStatus = updated.status || profile.subscriptionStatus;
        profile.tier = ACTIVE_SUBSCRIPTION_STATUSES.has(updated.status)
            ? resolveTierFromSubscription(updated, profile.tier)
            : "free";
        if (profile.tier === "free") profile.stripeSubscriptionId = null;
        await profile.save();

        return res.status(200).json({
            success: true,
            message: enabled ? "Auto-renew enabled" : "Auto-renew disabled",
            subscription: {
                cancelAtPeriodEnd: !!updated.cancel_at_period_end,
                subscriptionStatus: updated.status,
                currentPeriodEnd: updated.current_period_end ? new Date(updated.current_period_end * 1000).toISOString() : null,
                tier: profile.tier,
            },
        });
    } catch (error) {
        console.log("Error in setAutoRenewal:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getInvoices = async (req, res) => {
    try {
        const stripe = resolveStripeClient();
        if (!stripe) {
            return res.status(500).json({ success: false, message: "Stripe is not configured" });
        }

        const profile = await Profile.findOne({ userId: req.userId }).lean();
        if (!profile?.stripeCustomerId) {
            return res.status(200).json({ success: true, invoices: [] });
        }

        const invoiceList = await stripe.invoices.list({
            customer: profile.stripeCustomerId,
            limit: 20,
        });

        const invoices = (invoiceList.data || []).map((invoice) => ({
            id: invoice.id,
            number: invoice.number || invoice.id,
            status: invoice.status || "open",
            currency: invoice.currency || "usd",
            amountDue: invoice.amount_due || 0,
            amountPaid: invoice.amount_paid || 0,
            subtotal: invoice.subtotal || 0,
            tax: invoice.tax || 0,
            total: invoice.total || 0,
            hostedInvoiceUrl: invoice.hosted_invoice_url || null,
            invoicePdf: invoice.invoice_pdf || null,
            createdAt: invoice.created ? new Date(invoice.created * 1000).toISOString() : null,
            periodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
            periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
        }));

        return res.status(200).json({ success: true, invoices });
    } catch (error) {
        console.log("Error in getInvoices:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
