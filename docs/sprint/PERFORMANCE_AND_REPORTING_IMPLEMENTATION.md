# Performance and Reporting Implementation

The backend source now defines service-role-only session validation,
transactional session establishment, and a bounded dashboard snapshot RPC. The
reporting service exposes explicit generation phases and download readiness,
drains durable queues at startup and periodically, and retains immediate drains
after enqueue.

`render.yaml` assigns paid warm instances to the API gateway and reporting
service while keeping the remaining services on the free plan. All services are
declared in the Singapore region to avoid cross-region service traffic.

These are source changes, not deployment evidence. The Supabase migration must
not be applied until remote migration history is reconciled. Render plan changes
must be reviewed for cost and deployed deliberately, followed by queue-to-
Storage-to-download acceptance testing.
