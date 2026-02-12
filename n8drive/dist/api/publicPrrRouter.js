import express from "express";
function sanitizeDescription(description) {
    if (!description) {
        return "";
    }
    const trimmed = description.trim();
    if (!trimmed) {
        return "";
    }
    if (trimmed.length <= 500) {
        return trimmed;
    }
    return `${trimmed.slice(0, 497)}...`;
}
export function createPublicPrrRouter(prrStore) {
    const router = express.Router();
    router.get("/prrs/:publicId", (req, res) => {
        const publicId = String(req.params.publicId ?? "").trim();
        if (!publicId) {
            res.status(400).json({ error: "missing_public_id" });
            return;
        }
        const row = prrStore.getByPublicId(publicId);
        if (!row) {
            res.status(404).json({ error: "not_found" });
            return;
        }
        const agency = prrStore.getTenantAgencyName(row.tenant_id) ?? "Public Records Office";
        res.status(200).json({
            tracking_id: row.public_id,
            received_at: row.received_at,
            status: row.status,
            due_date: row.due_date || null,
            summary: sanitizeDescription(row.description),
            agency
        });
    });
    return router;
}
