"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import { createClient } from "@/utils/supabase/client"
import { useRouter } from "next/navigation"

const INACTIVITY_TIMEOUT = 3 * 60 * 1000 // 3 minutes
const SESSION_CHECK_INTERVAL = 10 * 1000 // check every 10s

export function useSessionSecurity() {
    const router = useRouter()
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const checkIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const supabase = createClient()

    const resetTimer = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(async () => {
            await supabase.auth.signOut()
            router.push("/login")
        }, INACTIVITY_TIMEOUT)
    }, [router, supabase.auth])

    async function validateSession() {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const sessionToken = localStorage.getItem("session_token")
            if (!sessionToken) return

            const admin = (await import("@/utils/supabase/admin")).createAdminClient()

            // Check clinic_accounts first
            const { data: clinicAccount } = await admin
                .from("clinic_accounts")
                .select("current_session_token")
                .eq("id", user.id)
                .maybeSingle()

            if (clinicAccount?.current_session_token !== sessionToken) {
                // Check student_accounts
                const { data: studentAccount } = await admin
                    .from("student_accounts")
                    .select("current_session_token")
                    .eq("user_id", user.id)
                    .maybeSingle()

                if (studentAccount?.current_session_token !== sessionToken) {
                    await supabase.auth.signOut()
                    router.push("/login")
                }
            }
        } catch {
            // network error during check — don't logout
        }
    }

    useEffect(() => {
        resetTimer()

        const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"]
        events.forEach((event) => window.addEventListener(event, resetTimer))

        checkIntervalRef.current = setInterval(validateSession, SESSION_CHECK_INTERVAL)

        const handlePageShow = async (event: PageTransitionEvent) => {
            if (event.persisted) {
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) {
                    window.location.href = "/login"
                }
            }
        }
        window.addEventListener("pageshow", handlePageShow)

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "SIGNED_OUT" || (!session && event !== "INITIAL_SESSION")) {
                window.location.href = "/login"
            }
        })

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            if (checkIntervalRef.current) clearInterval(checkIntervalRef.current)
            events.forEach((event) => window.removeEventListener(event, resetTimer))
            window.removeEventListener("pageshow", handlePageShow)
            subscription.unsubscribe()
        }
    }, [resetTimer, router, supabase.auth])
}