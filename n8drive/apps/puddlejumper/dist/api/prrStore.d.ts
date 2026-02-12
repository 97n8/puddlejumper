export declare const PRR_STATUSES: readonly ["received", "acknowledged", "in_progress", "extended", "closed"];
export type PrrStatus = (typeof PRR_STATUSES)[number];
export declare const ACCESS_REQUEST_STATUSES: readonly ["received", "under_review", "approved", "provisioned", "denied", "revoked", "closed"];
export type AccessRequestStatus = (typeof ACCESS_REQUEST_STATUSES)[number];
type PrrRow = {
    id: string;
    public_id: string | null;
    tenant_id: string;
    requester_name: string | null;
    requester_email: string | null;
    subject: string;
    description: string | null;
    status: PrrStatus;
    assigned_to: string | null;
    received_at: string;
    statutory_due_at: string;
    last_action_at: string | null;
    closed_at: string | null;
    disposition: string | null;
};
type PrrListItem = {
    id: string;
    received_at: string;
    statutory_due_at: string;
    status: PrrStatus;
    assigned_to: string | null;
    last_action_at: string | null;
};
type AccessRequestRow = {
    id: string;
    case_id: string;
    tenant_id: string;
    requester_name: string | null;
    requester_email: string;
    organization: string | null;
    requested_role: string;
    system: string;
    justification: string;
    status: AccessRequestStatus;
    received_at: string;
    last_action_at: string;
    closed_at: string | null;
    resolution: string | null;
    requested_by_user_id: string | null;
};
type AccessRequestNotificationRow = {
    id: number;
    access_request_id: string;
    tenant_id: string;
    target_email: string;
    status: string;
    payload_json: string;
    created_at: string;
    last_attempt_at: string | null;
    retry_count: number;
    next_attempt_at: string | null;
    last_error: string | null;
    delivery_response: string | null;
    sent_at: string | null;
};
type IntakeInput = {
    tenantId: string;
    requesterName: string | null;
    requesterEmail: string | null;
    subject: string;
    description: string | null;
    actorUserId: string;
    metadata?: Record<string, unknown>;
};
type IntakeResult = {
    id: string;
    public_id: string;
    tenantId: string;
    received_at: string;
    statutory_due_at: string;
    status: PrrStatus;
};
type AccessRequestIntakeInput = {
    tenantId: string;
    requesterName: string | null;
    requesterEmail: string;
    organization: string | null;
    requestedRole: string;
    system: string | null;
    justification: string;
    actorUserId: string;
    source: string | null;
};
type AccessRequestIntakeResult = {
    id: string;
    case_id: string;
    tenantId: string;
    received_at: string;
    status: AccessRequestStatus;
    notification: {
        target: string;
        status: string;
    };
};
type StatusTransitionResult = {
    ok: true;
    row: PrrListItem;
} | {
    ok: false;
    code: "not_found" | "invalid_transition";
    fromStatus?: PrrStatus;
};
type CloseResult = {
    ok: true;
    row: {
        id: string;
        status: "closed";
        closed_at: string;
        disposition: string | null;
        last_action_at: string;
    };
} | {
    ok: false;
    code: "not_found" | "invalid_transition";
    fromStatus?: PrrStatus;
};
type AccessRequestStatusTransitionResult = {
    ok: true;
    row: {
        id: string;
        case_id: string;
        status: AccessRequestStatus;
        last_action_at: string;
    };
} | {
    ok: false;
    code: "not_found" | "invalid_transition";
    fromStatus?: AccessRequestStatus;
};
type AccessRequestCloseResult = {
    ok: true;
    row: {
        id: string;
        case_id: string;
        status: "closed";
        closed_at: string;
        resolution: string | null;
        last_action_at: string;
    };
} | {
    ok: false;
    code: "not_found" | "invalid_transition";
    fromStatus?: AccessRequestStatus;
};
export declare function addBusinessDays(startIso: string, days: number): string;
export declare class PrrStore {
    private readonly db;
    constructor(dbPath: string);
    private ensureColumn;
    intake(input: IntakeInput): IntakeResult;
    intakeAccessRequest(input: AccessRequestIntakeInput): AccessRequestIntakeResult;
    listForTenant(args: {
        tenantId: string;
        status?: PrrStatus;
        assignedTo?: string;
        page: number;
        limit: number;
    }): {
        items: PrrListItem[];
        page: number;
        limit: number;
    };
    transitionStatus(args: {
        id: string;
        tenantId: string;
        toStatus: PrrStatus;
        actorUserId: string;
        metadata?: Record<string, unknown>;
    }): StatusTransitionResult;
    closeCase(args: {
        id: string;
        tenantId: string;
        actorUserId: string;
        disposition: string | null;
        metadata?: Record<string, unknown>;
    }): CloseResult;
    transitionAccessRequestStatus(args: {
        id: string;
        tenantId: string;
        toStatus: AccessRequestStatus;
        actorUserId: string;
        metadata?: Record<string, unknown>;
    }): AccessRequestStatusTransitionResult;
    closeAccessRequest(args: {
        id: string;
        tenantId: string;
        actorUserId: string;
        resolution: string | null;
        metadata?: Record<string, unknown>;
    }): AccessRequestCloseResult;
    getAuditCount(prrId: string): number;
    getRecordForTenant(prrId: string, tenantId: string): PrrRow | null;
    getByPublicId(publicId: string): {
        public_id: string;
        received_at: string;
        status: PrrStatus;
        due_date: string;
        description: string | null;
        tenant_id: string;
    } | null;
    getTenantAgencyName(tenantId: string): string | null;
    getAccessRequestForTenant(accessRequestId: string, tenantId: string): AccessRequestRow | null;
    getAccessRequestAuditCount(accessRequestId: string): number;
    getLatestAccessRequestNotification(accessRequestId: string): AccessRequestNotificationRow | null;
    claimPendingAccessRequestNotifications(limit: number): AccessRequestNotificationRow[];
    markAccessRequestNotificationDelivered(args: {
        notificationId: number;
        deliveredAt: string;
        responseSummary: string;
    }): void;
    markAccessRequestNotificationRetry(args: {
        notificationId: number;
        status: "retry" | "failed";
        nextAttemptAt: string | null;
        errorMessage: string;
    }): void;
}
export {};
