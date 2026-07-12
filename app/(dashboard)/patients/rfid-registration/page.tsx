"use client"

import { useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/client"

export default function RfidRegistrationPage() {
  const [rfidUid, setRfidUid] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [department, setDepartment] = useState("")
  const [studentNumber, setStudentNumber] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const supabase = createClient()

    const { error } = await supabase.from("clinic_profiles").insert({
      rfid_uid: rfidUid,
      first_name: firstName,
      last_name: lastName,
      email: email || null,
      department: department || null,
      student_number: studentNumber || null,
      active_status: true,
    })

    setLoading(false)

    if (error) {
      setMessage({ type: "error", text: error.message })
      return
    }

    setMessage({ type: "success", text: "Patient registered successfully. Future RFID scans will use this local profile." })
    setRfidUid("")
    setFirstName("")
    setLastName("")
    setEmail("")
    setDepartment("")
    setStudentNumber("")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFID Registration"
        description="Register a new patient with an RFID card. All future scans will use the local clinic database."
      />

      <Card className="max-w-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-medium">Clinic Registration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rfid_uid">RFID UID</Label>
              <Input
                id="rfid_uid"
                value={rfidUid}
                onChange={(e) => setRfidUid(e.target.value)}
                placeholder="e.g. A1B2C3D4"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first_name">First Name</Label>
                <Input
                  id="first_name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Last Name</Label>
                <Input
                  id="last_name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student_number">Student / Employee Number</Label>
              <Input
                id="student_number"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value)}
                placeholder="optional"
              />
            </div>

            {message && (
              <p
                className={
                  message.type === "success"
                    ? "text-sm text-success"
                    : "text-sm text-destructive"
                }
              >
                {message.text}
              </p>
            )}

            <Button type="submit" disabled={loading}>
              {loading ? "Registering..." : "Register Patient"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
