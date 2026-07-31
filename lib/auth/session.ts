"use client"

import { useEffect, useRef, useCallback } from "react"
import { createClient } from "@/utils/supabase/client"
import { logout } from "@/app/login/actions"
import { useRouter } from "next/navigation"

const INACTIVITY_TIMEOUT = 3 * 60 * 1000 // 3 minutes

export function useSessionSecurity() {
  const router = useRouter()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(async () => {
      await logout()
      router.push("/login?reason=idle_timeout")
    }, INACTIVITY_TIMEOUT)
  }, [router])

  useEffect(() => {
    resetTimer()

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"]
    events.forEach((event) => window.addEventListener(event, resetTimer))

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
      events.forEach((event) => window.removeEventListener(event, resetTimer))
      window.removeEventListener("pageshow", handlePageShow)
      subscription.unsubscribe()
    }
  }, [resetTimer, supabase.auth])
}