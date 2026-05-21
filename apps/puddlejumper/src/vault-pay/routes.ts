import express from "express";
import Stripe from "stripe";
// VAULT_PAY_DB_INJECTED
import Database from 'better-sqlite3';
import path from 'path';
const db = new Database(
  process.env.VAULT_PAY_DB || path.join(process.cwd(), 'data/vault-pay.db')
);
db.pragma('journal_mode = WAL');


const router = express.Router();

// Lazy-init so dotenv.config() in server.ts has time to populate process.env
// before STRIPE_SECRET_KEY is read.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  _stripe = new Stripe(key, { apiVersion: "2024-04-10" });
  return _stripe;
}

// POST /api/stripe/checkout
// Body: { invoiceId, amountCents, description, clientName, clientEmail? }
router.post("/checkout", async (req, res) => {
  const { invoiceId, amountCents, description, clientName, clientEmail } = req.body;

  if (!invoiceId || !amountCents || !description) {
    return res.status(400).json({ error: "invoiceId, amountCents, description required" });
  }

  try {
    const session = await getStripe().checkout.sessions.create({
      payment_method_types: ["card", "us_bank_account"], // card + ACH debit
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: amountCents, // 2500000 for $25,000
            product_data: {
              name: description,
              metadata: { invoiceId, clientName },
            },
          },
          quantity: 1,
        },
      ],
      // Where Stripe sends the client after payment
      success_url: `${process.env.APP_URL}/pay/success?invoice=${invoiceId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/pay/${invoiceId}`,
      // Pre-fill email if known
      ...(clientEmail ? { customer_email: clientEmail } : {}),
      // Attach invoice ID to session for webhook reconciliation
      metadata: { invoiceId, clientName },
      // Payment intent settings — statement descriptor
      payment_intent_data: {
        description: `PublicLogic LLC · ${invoiceId}`,
        metadata: { invoiceId },
      },
    });

    // Log to PJ audit trail before returning
    await logAuditEvent({
      invoiceId,
      event: "stripe_checkout_initiated",
      actor: "client",
      meta: { sessionId: session.id, amount: amountCents },
    });

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe checkout error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/webhook
// Stripe calls this when payment succeeds/fails
// Requires: STRIPE_WEBHOOK_SECRET from `stripe listen` or dashboard
router.post(
  "/webhook",
  express.raw({ type: "application/json" }), // raw body required for signature verification
  async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err: any) {
      console.error("Webhook signature failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoiceId;
        const amountPaid = session.amount_total; // cents

        if (invoiceId) {
          await markInvoicePaid({
            invoiceId,
            amountPaid: amountPaid ?? 0,
            stripeSessionId: session.id,
            paymentMethod: session.payment_method_types?.[0] ?? "card",
          });
        }
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const invoiceId = pi.metadata?.invoiceId;
        if (invoiceId) {
          await logAuditEvent({
            invoiceId,
            event: "payment_failed",
            actor: "stripe",
            meta: { error: pi.last_payment_error?.message },
          });
        }
        break;
      }
    }

    res.json({ received: true });
  }
);

// ── DB helpers (wire these to your PJ SQLite layer) ──────────────────────────

async function markInvoicePaid({
  invoiceId,
  amountPaid,
  stripeSessionId,
  paymentMethod,
}: {
  invoiceId: string;
  amountPaid: number;
  stripeSessionId: string;
  paymentMethod: string;
}) {
  // Replace with your actual better-sqlite3 db instance import
  // db.prepare(`UPDATE invoices SET status='paid', paid_at=? WHERE id=?`)
  //   .run(new Date().toISOString(), invoiceId);
  await logAuditEvent({
    invoiceId,
    event: "payment_received",
    actor: "stripe",
    meta: { amountPaid, stripeSessionId, paymentMethod },
  });
  console.log(`Invoice ${invoiceId} marked paid via Stripe · session ${stripeSessionId}`);
}

async function logAuditEvent({
  invoiceId,
  event,
  actor,
  meta,
}: {
  invoiceId: string;
  event: string;
  actor: string;
  meta: Record<string, any>;
}) {
  // Wire to PJ's append-only audit_events table (SQLite trigger-enforced)
  // db.prepare(`INSERT INTO audit_events (entity_type,entity_id,event,actor,meta,created_at)
  //             VALUES ('invoice',?,?,?,?,?)`)
  //   .run(invoiceId, event, actor, JSON.stringify(meta), new Date().toISOString());
  console.log(`[AUDIT] ${invoiceId} · ${event} · ${actor}`, meta);
}

export default router;
