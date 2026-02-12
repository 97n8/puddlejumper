import { z } from "zod";
export declare const loginRequestSchema: z.ZodObject<{
    username: z.ZodString;
    password: z.ZodString;
}, z.core.$strict>;
export declare const evaluateRequestSchema: z.ZodObject<{
    workspace: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        charter: z.ZodObject<{
            authority: z.ZodBoolean;
            accountability: z.ZodBoolean;
            boundary: z.ZodBoolean;
            continuity: z.ZodBoolean;
        }, z.core.$strict>;
    }, z.core.$strict>;
    municipality: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        population: z.ZodOptional<z.ZodNumber>;
        statutes: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        policies: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodRecord<z.ZodString, z.ZodUnknown>>>;
        risk_profile: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, z.core.$strict>;
    operator: z.ZodObject<{
        id: z.ZodString;
        name: z.ZodOptional<z.ZodString>;
        role: z.ZodOptional<z.ZodString>;
        permissions: z.ZodOptional<z.ZodArray<z.ZodString>>;
        delegations: z.ZodOptional<z.ZodArray<z.ZodObject<{
            id: z.ZodOptional<z.ZodString>;
            from: z.ZodOptional<z.ZodString>;
            until: z.ZodOptional<z.ZodString>;
            to: z.ZodOptional<z.ZodString>;
            scope: z.ZodOptional<z.ZodArray<z.ZodString>>;
            precedence: z.ZodOptional<z.ZodNumber>;
            delegator: z.ZodOptional<z.ZodString>;
            delegatee: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>>>;
    }, z.core.$strict>;
    action: z.ZodObject<{
        mode: z.ZodOptional<z.ZodEnum<{
            launch: "launch";
            governed: "governed";
        }>>;
        trigger: z.ZodObject<{
            type: z.ZodString;
            reference: z.ZodOptional<z.ZodString>;
            evidence: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        }, z.core.$strict>;
        intent: z.ZodString;
        targets: z.ZodArray<z.ZodString>;
        environment: z.ZodOptional<z.ZodEnum<{
            production: "production";
            staging: "staging";
            pilot: "pilot";
        }>>;
        metadata: z.ZodObject<{
            description: z.ZodOptional<z.ZodString>;
            archieve: z.ZodOptional<z.ZodObject<{
                dept: z.ZodString;
                type: z.ZodString;
                date: z.ZodString;
                seq: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
                v: z.ZodUnion<readonly [z.ZodNumber, z.ZodString]>;
            }, z.core.$strict>>;
            timer: z.ZodOptional<z.ZodObject<{
                due: z.ZodString;
            }, z.core.$strict>>;
            state: z.ZodOptional<z.ZodObject<{
                from: z.ZodString;
                to: z.ZodString;
            }, z.core.$strict>>;
            calendar: z.ZodOptional<z.ZodObject<{
                eventId: z.ZodString;
            }, z.core.$strict>>;
            files: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                content: z.ZodString;
                encoding: z.ZodEnum<{
                    "utf-8": "utf-8";
                    base64: "base64";
                }>;
            }, z.core.$strict>>>;
            urgency: z.ZodOptional<z.ZodEnum<{
                emergency: "emergency";
                normal: "normal";
            }>>;
            deployMode: z.ZodOptional<z.ZodEnum<{
                pr: "pr";
                direct: "direct";
            }>>;
            connectorHealth: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>>>;
            connectorStatus: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<readonly [z.ZodBoolean, z.ZodString]>>>;
            restricted: z.ZodOptional<z.ZodBoolean>;
            automationId: z.ZodOptional<z.ZodString>;
            expectedPlanHash: z.ZodOptional<z.ZodString>;
            canonicalUrl: z.ZodOptional<z.ZodString>;
            canonicalSha: z.ZodOptional<z.ZodString>;
        }, z.core.$strict>;
        requestId: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    timestamp: z.ZodString;
}, z.core.$strict>;
export type EvaluateRequestBody = z.infer<typeof evaluateRequestSchema>;
export declare const prrStatusSchema: z.ZodEnum<{
    received: "received";
    acknowledged: "acknowledged";
    in_progress: "in_progress";
    extended: "extended";
    closed: "closed";
}>;
export declare const prrIntakeRequestSchema: z.ZodObject<{
    tenantId: z.ZodOptional<z.ZodString>;
    requester_name: z.ZodOptional<z.ZodString>;
    requester_email: z.ZodOptional<z.ZodString>;
    subject: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const prrStatusTransitionRequestSchema: z.ZodObject<{
    to_status: z.ZodEnum<{
        received: "received";
        acknowledged: "acknowledged";
        in_progress: "in_progress";
        extended: "extended";
        closed: "closed";
    }>;
}, z.core.$strict>;
export declare const prrCloseRequestSchema: z.ZodObject<{
    disposition: z.ZodString;
}, z.core.$strict>;
export declare const accessRequestStatusSchema: z.ZodEnum<{
    approved: "approved";
    received: "received";
    closed: "closed";
    under_review: "under_review";
    provisioned: "provisioned";
    denied: "denied";
    revoked: "revoked";
}>;
export declare const accessRequestIntakeRequestSchema: z.ZodObject<{
    tenantId: z.ZodOptional<z.ZodString>;
    requester_name: z.ZodOptional<z.ZodString>;
    requester_email: z.ZodString;
    organization: z.ZodOptional<z.ZodString>;
    requested_role: z.ZodString;
    system: z.ZodOptional<z.ZodString>;
    justification: z.ZodString;
    source: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const accessRequestStatusTransitionRequestSchema: z.ZodObject<{
    to_status: z.ZodEnum<{
        approved: "approved";
        received: "received";
        closed: "closed";
        under_review: "under_review";
        provisioned: "provisioned";
        denied: "denied";
        revoked: "revoked";
    }>;
}, z.core.$strict>;
export declare const accessRequestCloseRequestSchema: z.ZodObject<{
    resolution: z.ZodOptional<z.ZodString>;
}, z.core.$strict>;
export declare const pjExecuteRequestSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    actionId: z.ZodLiteral<"environment.create">;
    payload: z.ZodObject<{
        name: z.ZodString;
        config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
        requestId: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    mode: z.ZodDefault<z.ZodEnum<{
        "dry-run": "dry-run";
        execute: "execute";
    }>>;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strict>, z.ZodObject<{
    actionId: z.ZodLiteral<"environment.update">;
    payload: z.ZodObject<{
        environmentId: z.ZodString;
        patch: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        requestId: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    mode: z.ZodDefault<z.ZodEnum<{
        "dry-run": "dry-run";
        execute: "execute";
    }>>;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strict>, z.ZodObject<{
    actionId: z.ZodLiteral<"environment.promote">;
    payload: z.ZodObject<{
        sourceEnvironmentId: z.ZodString;
        targetEnvironmentId: z.ZodString;
        merge: z.ZodOptional<z.ZodBoolean>;
        snapshotTarget: z.ZodOptional<z.ZodBoolean>;
        requestId: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    mode: z.ZodDefault<z.ZodEnum<{
        "dry-run": "dry-run";
        execute: "execute";
    }>>;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strict>, z.ZodObject<{
    actionId: z.ZodLiteral<"environment.snapshot">;
    payload: z.ZodObject<{
        environmentId: z.ZodString;
        message: z.ZodOptional<z.ZodString>;
        requestId: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>;
    mode: z.ZodDefault<z.ZodEnum<{
        "dry-run": "dry-run";
        execute: "execute";
    }>>;
    requestId: z.ZodOptional<z.ZodString>;
}, z.core.$strict>], "actionId">;
export type PjExecuteRequestBody = z.infer<typeof pjExecuteRequestSchema>;
