"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { getUserRole } from "@/lib/auth/get-user-role"
import { isAdmin } from "@/lib/auth/roles"
import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"

async function requireAdmin() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  console.log("========== REQUIRE ADMIN ==========")
  console.log("Auth Error:", authError)
  console.log("Current User:", user?.id)

  if (!user) {
    return { error: "Not authenticated", user: null }
  }

  const role = await getUserRole(user.id)

  console.log("Current Role:", role)

  if (!isAdmin(role)) {
    return {
      error: "Only administrators can manage operators",
      user: null,
    }
  }

  console.log("===================================")

  return { error: null, user }
}

export async function createOperator(formData: FormData) {
  try {
    console.log("")
    console.log("==============================================")
    console.log("CREATE OPERATOR START")
    console.log("==============================================")

    const auth = await requireAdmin()

    if (auth.error || !auth.user) {
      console.error("Authorization Failed:", auth.error)
      return { error: auth.error ?? "Unauthorized" }
    }

    const email = (formData.get("email") as string)?.trim()
    const password = formData.get("password") as string
    const fullName = (formData.get("fullName") as string)?.trim()
    const role = (formData.get("role") as string)?.trim() || "nurse"

    console.log("Incoming Data:")
    console.log({
      email,
      fullName,
      passwordLength: password?.length,
    })

    if (!email || !password) {
      return {
        error: "Email and password are required",
      }
    }

    if (password.length < 8) {
      return {
        error: "Password must be at least 8 characters",
      }
    }

    console.log("")
    console.log("Creating Admin Client...")

    const admin = createAdminClient()

    console.log("Admin Client Created Successfully")

    console.log("")
    console.log("STEP 1 - Creating Auth User")

    const {
      data: created,
      error: createError,
    } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    console.log("Auth User Result:")
    console.log(created)

    if (createError) {
      console.error("createUser Error")
      console.error(createError)

      return {
        error: createError.message,
      }
    }

    if (!created.user) {
      return {
        error: "User was not returned after creation.",
      }
    }

    console.log("")
    console.log("STEP 2 - Inserting Profile")

    const profilePayload = {
      id: created.user.id,
      email,
      role,
      full_name: fullName || null,
    }

    console.log("Payload:")
    console.log(profilePayload)

    const {
      data: insertedProfile,
      error: profileError,
    } = await admin
      .from("profiles")
      .upsert(profilePayload)
      .select()

    console.log("")
    console.log("Insert Result:")
    console.log(insertedProfile)

    if (profileError) {
      console.error("")
      console.error("PROFILE INSERT FAILED")
      console.error(profileError)

      console.log("Cleaning up Auth user...")

      const { error: deleteError } =
        await admin.auth.admin.deleteUser(created.user.id)

      console.log("Cleanup Result:")
      console.log(deleteError)

      return {
        error: JSON.stringify(profileError, null, 2),
      }
    }

    console.log("")
    console.log("SUCCESS")
    console.log("Operator Created Successfully")

    revalidatePath("/admin/operators")

    return {
      success: true,
    }
  } catch (err) {
    console.error("")
    console.error("UNEXPECTED ERROR")
    console.error(err)

    if (err instanceof Error) {
      console.error("Message:", err.message)
      console.error("Stack:", err.stack)

      return {
        error: err.message,
      }
    }

    return {
      error: "Unknown server error.",
    }
  } finally {
    console.log("==============================================")
    console.log("CREATE OPERATOR END")
    console.log("==============================================")
  }
}

export async function removeOperator(userId: string) {
  try {
    console.log("")
    console.log("REMOVE OPERATOR:", userId)

    const auth = await requireAdmin()

    if (auth.error || !auth.user) {
      return {
        error: auth.error ?? "Unauthorized",
      }
    }

    if (userId === auth.user.id) {
      return {
        error: "You cannot remove your own account",
      }
    }

    const admin = createAdminClient()

    console.log("Deleting profile...")

    const { error: profileDeleteError } = await admin
      .from("profiles")
      .delete()
      .eq("id", userId)

    if (profileDeleteError) {
      console.error(profileDeleteError)
      return {
        error: profileDeleteError.message,
      }
    }

    console.log("Deleting auth user...")

    const { error: deleteAuthError } =
      await admin.auth.admin.deleteUser(userId)

    if (deleteAuthError) {
      console.error(deleteAuthError)

      return {
        error: deleteAuthError.message,
      }
    }

    revalidatePath("/admin/operators")

    console.log("Operator Removed Successfully")

    return {
      success: true,
    }
  } catch (err) {
    console.error(err)

    if (err instanceof Error) {
      return {
        error: err.message,
      }
    }

    return {
      error: "Unknown server error.",
    }
  }
}
