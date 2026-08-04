"use client"

import { useState, useEffect } from "react"
import { PageHeader } from "@/components/page-header"
import { ClearanceRequestForm } from "@/components/clearance/clearance-request-form"
import { submitClearanceRequest } from "@/app/actions/clearances"
import { getStudentProfileIdAction } from "@/app/student/actions"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function StudentClearancesRequestPage() {
  const router = useRouter()
  const [studentId, setStudentId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadStudentId() {
      try {
        const { studentId: id } = await getStudentProfileIdAction()
        setStudentId(id)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    loadStudentId()
  }, [])

  if (loading) {
    return (
      <main className="space-y-6 max-w-3xl mx-auto mt-[-25px] px-4 py-4">
        <PageHeader title="Request Health Clearance" description="Submit a request for medical health clearance." />
        <div className="h-40 bg-zinc-100 rounded-lg animate-pulse" />
      </main>
    )
  }

  if (!studentId) {
    return (
      <main className="space-y-6 max-w-3xl mx-auto mt-[-25px] px-4 py-4">
        <PageHeader title="Request Clearance" description="Submit a health clearance request." />
        <div className="text-center py-10 text-zinc-500 text-sm">
          Student profile record not found. Please contact clinic administration.
        </div>
      </main>
    )
  }

  return (
    <main className="space-y-6 max-w-3xl mx-auto mt-[-25px] px-4 py-4">
      <PageHeader title="Request Health Clearance" description="Submit a request for medical health clearance." />
      <ClearanceRequestForm
        requesterType="student"
        requesterId={studentId}
        onSubmit={async (data) => {
          const result = await submitClearanceRequest({
            requester_type: "student",
            requester_id: studentId,
            purpose: data.purpose
          })
          if (result.error) {
            toast.error(result.error)
            throw new Error(result.error)
          }
          toast.success("Clearance request submitted successfully!")
          router.push("/student/clearances")
        }}
      />
    </main>
  )
}