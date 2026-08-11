import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";

export interface PortalEmailChange {
  changed: boolean;
  previousAuthEmail: string | null;
  previousDirectoryEmail: string | null;
  userId: string | null;
}

interface PreparePortalEmailChangeInput {
  currentProfileEmail: string | null;
  nextProfileEmail: string | null;
  userId: string | null;
}

// Synchronizes a linked portal user's Auth email before its profile is updated.
export async function preparePortalEmailChange(
  input: PreparePortalEmailChangeInput,
): Promise<{ change: PortalEmailChange; error: string | null }> {
  const unchanged: PortalEmailChange = {
    changed: false,
    previousAuthEmail: null,
    previousDirectoryEmail: null,
    userId: input.userId,
  };

  if (!input.userId) {
    return { change: unchanged, error: null };
  }

  const currentEmail = normalizeEmail(input.currentProfileEmail);
  const nextEmail = normalizeEmail(input.nextProfileEmail);
  if (currentEmail === nextEmail) {
    return { change: unchanged, error: null };
  }
  if (!nextEmail) {
    return {
      change: unchanged,
      error: "A linked portal account must keep a valid login email.",
    };
  }

  const admin = createAdminClient();
  const [
    { data, error: userError },
    { data: directoryUser, error: directoryError },
  ] = await Promise.all([
      admin.auth.admin.getUserById(input.userId),
      admin
        .from("users")
        .select("email")
        .eq("id", input.userId)
        .maybeSingle(),
    ]);
  const previousAuthEmail = normalizeEmail(data.user?.email ?? null);
  const previousDirectoryEmail = normalizeEmail(directoryUser?.email ?? null);
  if (
    userError ||
    directoryError ||
    !data.user ||
    !previousAuthEmail ||
    !previousDirectoryEmail
  ) {
    return {
      change: unchanged,
      error: "The linked portal identity could not be verified.",
    };
  }

  const { error: sessionError } = await admin
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", input.userId)
    .is("revoked_at", null);
  if (sessionError) {
    return {
      change: unchanged,
      error: "Existing portal sessions could not be revoked.",
    };
  }

  if (previousAuthEmail !== nextEmail) {
    const { error: authError } = await admin.auth.admin.updateUserById(
      input.userId,
      {
        email: nextEmail,
        email_confirm: true,
      },
    );
    if (authError) {
      return {
        change: unchanged,
        error: "The portal login email could not be updated.",
      };
    }
  }

  if (previousDirectoryEmail !== nextEmail) {
    const { error: directoryUpdateError } = await admin
      .from("users")
      .update({ email: nextEmail })
      .eq("id", input.userId);
    if (directoryUpdateError) {
      if (previousAuthEmail !== nextEmail) {
        await admin.auth.admin.updateUserById(input.userId, {
          email: previousAuthEmail,
          email_confirm: true,
        });
      }
      return {
        change: unchanged,
        error: "The portal directory email could not be updated.",
      };
    }
  }

  return {
    change: {
      changed:
        previousAuthEmail !== nextEmail || previousDirectoryEmail !== nextEmail,
      previousAuthEmail,
      previousDirectoryEmail,
      userId: input.userId,
    },
    error: null,
  };
}

// Restores the Auth email when the matching profile update fails.
export async function rollbackPortalEmailChange(
  change: PortalEmailChange,
): Promise<boolean> {
  if (
    !change.changed ||
    !change.userId ||
    !change.previousAuthEmail ||
    !change.previousDirectoryEmail
  ) {
    return true;
  }

  const admin = createAdminClient();
  const [{ error: authError }, { error: directoryError }] = await Promise.all([
    admin.auth.admin.updateUserById(change.userId, {
      email: change.previousAuthEmail,
      email_confirm: true,
    }),
    admin
      .from("users")
      .update({ email: change.previousDirectoryEmail })
      .eq("id", change.userId),
  ]);
  return !authError && !directoryError;
}

// Normalizes an optional email for consistent Auth/profile comparisons.
function normalizeEmail(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized || null;
}
