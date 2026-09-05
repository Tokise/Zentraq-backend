import { unstable_cache } from "../../../../runtime/effects.ts";
import { getActionActor, hasAnyRole } from "../../../../runtime/context.ts";
import { createAdminClient } from "../../../../runtime/context.ts";
import { z } from "npm:zod@4.4.3";

const paginationSchema = z.object({
  page: z.number().finite().optional(),
  pageSize: z.number().finite().optional(),
}).strict();

type ClinicRole = "admin" | "doctor" | "nurse";

export interface ClinicalVisitHistoryRow {
  consultation_id: string;
  visit_id: string;
  patient_type: "student" | "faculty" | "staff" | "visitor";
  patient_name: string;
  visit_type: string;
  patient_complaint: string;
  check_in_time: string;
  check_out_time: string | null;
  status: string;
  claimed_by_name: string | null;
  claimed_by_role: ClinicRole | null;
  completed_by_name: string | null;
  completed_by_role: ClinicRole | null;
}

export interface ClinicalVisitHistoryPage {
  error: string | null;
  page: number;
  pageSize: number;
  total: number;
  visits: ClinicalVisitHistoryRow[];
}

interface NamedPatient {
  first_name: string | null;
  last_name: string | null;
}

interface HistoryVisitRelation {
  id: string;
  patient_type: "student" | "faculty" | "staff" | "visitor";
  visit_type: string;
  check_in_time: string;
  check_out_time: string | null;
  students: NamedPatient | NamedPatient[] | null;
  faculty: NamedPatient | NamedPatient[] | null;
  staff: NamedPatient | NamedPatient[] | null;
  visitors: NamedPatient | NamedPatient[] | null;
}

interface HistoryQueryRow {
  id: string;
  patient_complaint: string | null;
  status: string;
  claimant:
    | { display_name: string | null; role: ClinicRole | null }
    | Array<{ display_name: string | null; role: ClinicRole | null }>
    | null;
  completed_by:
    | { display_name: string | null; role: ClinicRole | null }
    | Array<{ display_name: string | null; role: ClinicRole | null }>
    | null;
  clinic_visits: HistoryVisitRelation | HistoryVisitRelation[] | null;
}
// Returns completed consultations while enforcing clinician assignment server-side.
export async function getClinicalVisitHistoryAction(
  input: unknown = {},
): Promise<ClinicalVisitHistoryPage> {
  // Older callers serialize an omitted positional argument as JSON null.
  const parsed = paginationSchema.safeParse(input ?? {});
  if (!parsed.success) {
    return {
      error: "Invalid history pagination",
      page: 1,
      pageSize: 25,
      total: 0,
      visits: [],
    };
  }
  const page = Math.max(1, Math.floor(parsed.data.page ?? 1));
  const pageSize = Math.max(1, Math.min(25, Math.floor(parsed.data.pageSize ?? 25)));
  const actor = await getActionActor();
  if (!actor || !hasAnyRole(actor, ["admin", "doctor", "nurse"])) {
    return { error: "Access denied", page, pageSize, total: 0, visits: [] };
  }

  const admin = createAdminClient();
  const { data: account, error: accountError } = await admin
    .from("clinic_accounts")
    .select("id")
    .eq("user_id", actor.id)
    .eq("role", actor.role)
    .eq("is_active", true)
    .maybeSingle();

  if (accountError || !account) {
    return {
      error: accountError?.message ?? "Active clinic account not found",
      page,
      pageSize,
      total: 0,
      visits: [],
    };
  }

  return fetchCachedVisitHistory(
    actor.id,
    actor.role,
    account.id,
    page,
    pageSize,
  );
}

// Loads a bounded history page using the verified clinician's assignment scope.
function fetchCachedVisitHistory(
  actorId: string,
  actorRole: string,
  accountId: string,
  page: number,
  pageSize: number,
) {
  return unstable_cache(
    async () => {
      const admin = createAdminClient();
      let query = admin
        .from("consultations")
        .select(
          `
          id,
          patient_complaint,
          status,
          claimant:clinic_accounts!consultations_claimed_by_clinic_account_id_fkey(
            display_name,
            role
          ),
          completed_by:clinic_accounts!consultations_completed_by_clinic_account_id_fkey(
            display_name,
            role
          ),
          clinic_visits!inner(
            id,
            patient_type,
            visit_type,
            check_in_time,
            check_out_time,
            students(first_name, last_name),
            faculty(first_name, last_name),
            staff(first_name, last_name),
            visitors(first_name, last_name)
          )
        `,
          { count: "exact" },
        )
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (actorRole !== "admin") {
        query = query.or(
          `doctor_id.eq.${accountId},nurse_id.eq.${accountId},claimed_by_clinic_account_id.eq.${accountId},completed_by_clinic_account_id.eq.${accountId}`,
        );
      }

      const { count, data, error } = await query;
      if (error) {
        return { error: error.message, page, pageSize, total: 0, visits: [] };
      }

      const rows = (data ?? []) as unknown as HistoryQueryRow[];
      const visits = rows.flatMap((row) => {
        const visit = firstRelation(row.clinic_visits);
        if (!visit) return [];

        const patient = firstRelation(visit.students) ??
          firstRelation(visit.faculty) ??
          firstRelation(visit.staff) ?? firstRelation(visit.visitors);
        const claimant = firstRelation(row.claimant);
        const completedBy = firstRelation(row.completed_by);

        return [
          {
            consultation_id: row.id,
            visit_id: visit.id,
            patient_type: visit.patient_type,
            patient_name:
              `${patient?.first_name ?? ""} ${patient?.last_name ?? ""}`
                .trim() ||
              "Unknown patient",
            visit_type: visit.visit_type,
            patient_complaint: row.patient_complaint ?? "",
            check_in_time: visit.check_in_time,
            check_out_time: visit.check_out_time,
            status: row.status,
            claimed_by_name: claimant?.display_name ?? null,
            claimed_by_role: claimant?.role ?? null,
            completed_by_name: completedBy?.display_name ?? null,
            completed_by_role: completedBy?.role ?? null,
          },
        ];
      });

      return {
        error: null,
        page,
        pageSize,
        total: count ?? visits.length,
        visits,
      };
    },
    [`visit-history-${actorId}-${actorRole}-${page}-${pageSize}`],
    { revalidate: 5, tags: [`visit-history-${actorId}`] },
  )();
}

// Normalizes Supabase to-one relationships returned as an object or array.
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
