// ~/puddlejumper/api/src/services/invoice-renderer.ts
//
// Reads templates/invoices/base-invoice.html, substitutes case data,
// writes the rendered HTML to /public/pay/{INVOICE_ID}.html
//
// Usage:
//   import { renderInvoice } from "./services/invoice-renderer";
//   await renderInvoice(caseRecord);

import fs from "fs/promises";
import path from "path";

const TEMPLATE_PATH = path.join(process.cwd(), "templates/invoices/base-invoice.html");
const OUTPUT_DIR    = path.join(process.cwd(), "public/pay");

export interface InvoiceCase {
  id: string;                  // 'PL-2026-001'
  clientEntity: string;        // 'Energy Mann & Sunn, Inc.'
  clientContact: string;       // 'Robert C. McCall Jr.'
  clientAddress: string;       // '70 Macomb Place, Suite 200\nMt Clemens, MI 48043'
  clientRefLabel?: string;     // 'MICHIGAN BUSINESS ID'
  clientRefId?: string;        // '900117109'
  clientEmail?: string;        // for Stripe Checkout prefill
  title: string;               // 'Michigan LTC Network\nResource Recovery Corridor'
  lineItemTitle: string;       // 'VAULT Compliance Engagement — Phase 1'
  lineItemDetail: string;      // longer description
  amountCents: number;         // 2500000
  issuedDate: string;          // 'May 20, 2026'
  issuedTimestamp: string;     // '2026-05-20 09:14'
  paymentTerms: string;        // 'Due on receipt'
  termsNote: string;           // the amber callout
}

export async function renderInvoice(c: InvoiceCase): Promise<string> {
  const template = await fs.readFile(TEMPLATE_PATH, "utf8");

  const amountDollars = (c.amountCents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
  const amountFormatted = `$${amountDollars}`;

  const vars: Record<string, string> = {
    INVOICE_ID:        c.id,
    INVOICE_TITLE:     c.title.replace(/\n/g, "<br>"),
    CLIENT_ENTITY:     escapeHtml(c.clientEntity),
    CLIENT_CONTACT:    escapeHtml(c.clientContact),
    CLIENT_ADDRESS:    escapeHtml(c.clientAddress).replace(/\n/g, "<br>"),
    CLIENT_REF_LABEL:  c.clientRefLabel || "REFERENCE",
    CLIENT_REF_ID:     c.clientRefId    || "—",
    CLIENT_EMAIL:      c.clientEmail    || "",
    LINE_ITEM_TITLE:   escapeHtml(c.lineItemTitle),
    LINE_ITEM_DETAIL:  escapeHtml(c.lineItemDetail),
    AMOUNT_CENTS:      String(c.amountCents),
    AMOUNT_FORMATTED:  amountFormatted,
    ISSUED_DATE:       c.issuedDate,
    ISSUED_TIMESTAMP:  c.issuedTimestamp,
    PAYMENT_TERMS:     c.paymentTerms,
    TERMS_NOTE:        escapeHtml(c.termsNote),
  };

  let rendered = template;
  for (const [key, val] of Object.entries(vars)) {
    rendered = rendered.replaceAll(`{{${key}}}`, val);
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, `${c.id}.html`);
  await fs.writeFile(outPath, rendered, "utf8");

  return outPath; // e.g. /public/pay/PL-2026-001.html → served at /pay/PL-2026-001
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ── Express route to serve rendered invoices ───────────────────────────────
// Add to your main router:
//
//   import express from "express";
//   import path from "path";
//   app.get("/pay/:invoiceId", (req, res) => {
//     const file = path.join(process.cwd(), "public/pay", `${req.params.invoiceId}.html`);
//     res.sendFile(file, (err) => {
//       if (err) res.status(404).send("Invoice not found");
//     });
//   });

// ── Example: render PL-2026-001 ────────────────────────────────────────────
//
// await renderInvoice({
//   id: "PL-2026-001",
//   clientEntity: "Energy Mann & Sunn, Inc.",
//   clientContact: "Robert C. McCall Jr.",
//   clientAddress: "70 Macomb Place, Suite 200\nMt Clemens, MI 48043",
//   clientRefLabel: "MICHIGAN BUSINESS ID",
//   clientRefId: "900117109",
//   clientEmail: "robert.mccall@energymannsunn.com",
//   title: "Michigan LTC Network\nResource Recovery Corridor",
//   lineItemTitle: "VAULT Compliance Engagement — Phase 1",
//   lineItemDetail: "Discovery & Systems Mapping · Operational readiness assessment · Reconciled financial model · Six-gate governance roadmap · Regulatory pathway and permit stack (EGLE pre-submittal) · Documentation infrastructure · Knowledge transfer plan · Sites: Flint, Coleman, Lincoln · Lake State Railway coordination · Geocycle feedstock documentation",
//   amountCents: 2500000,
//   issuedDate: "May 20, 2026",
//   issuedTimestamp: "2026-05-20 09:14",
//   paymentTerms: "Due on receipt",
//   termsNote: "This Phase 1 fee of $25,000 credits against the anchor-site buildout total upon authorization of Phase 2. Payment due on receipt of this invoice per the engagement letter executed May 2026.",
// });
