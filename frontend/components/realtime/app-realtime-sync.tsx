"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/utils/supabase/client"

export type RealtimeDomain =
  | "announcements"
  | "appointments"
  | "consultations"
  | "profiles"
  | "system"

const DOMAIN_EVENT_NAME = "zentraq:domain-changed"
const REALTIME_DOMAINS = new Set<RealtimeDomain>([
  "announcements",
  "appointments",
  "consultations",
  "profiles",
  "system",
])

interface DomainEventDetail {
  domain: RealtimeDomain
}

// Narrows a broadcast payload to one allowlisted application domain.
function parseDomain(payload: unknown): RealtimeDomain | null {
  if (!payload || typeof payload !== "object") return null
  const candidate = Reflect.get(payload, "payload")
  if (!candidate || typeof candidate !== "object") return null
  const domain = Reflect.get(candidate, "domain")
  return typeof domain === "string" &&
      REALTIME_DOMAINS.has(domain as RealtimeDomain)
    ? domain as RealtimeDomain
    : null
}

// Keeps authenticated dashboard routes synchronized with minimized DB broadcasts.
export function AppRealtimeSync() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null

    async function subscribe() {
      const { data } = await supabase.auth.getSession()
      if (!active || !data.session) return
      await supabase.realtime.setAuth(data.session.access_token)
      channel = supabase
        .channel("app:changes", {
          config: { private: true },
        })
        .on(
          "broadcast",
          { event: "domain-changed" },
          (payload) => {
            const domain = parseDomain(payload)
            if (!domain) return
            window.dispatchEvent(
              new CustomEvent<DomainEventDetail>(DOMAIN_EVENT_NAME, {
                detail: { domain },
              }),
            )
            router.refresh()
          },
        )
        .subscribe()
    }

    void subscribe()
    return () => {
      active = false
      if (channel) void supabase.removeChannel(channel)
    }
  }, [router, supabase])

  return null
}

// Runs a local DTO reload when the shared Realtime bridge emits a matching domain.
export function useDomainInvalidation(
  domain: RealtimeDomain,
  reload: () => void,
) {
  useEffect(() => {
    function handleDomainChange(event: Event) {
      const detail = (event as CustomEvent<DomainEventDetail>).detail
      if (detail?.domain === domain) reload()
    }

    window.addEventListener(DOMAIN_EVENT_NAME, handleDomainChange)
    return () => {
      window.removeEventListener(DOMAIN_EVENT_NAME, handleDomainChange)
    }
  }, [domain, reload])
}
