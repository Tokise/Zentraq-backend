"use client"

import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/section-header"
import { StatCard } from "@/components/stat-card"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { getDashboardDataAction } from "@/actions/system/dashboard"
import { Stethoscope, Users, AlertTriangle, FileCheck } from "lucide-react"

export default function DoctorDashboardPage() {
    const [stats, setStats] = useState({
        patientsToday: 0,
        consultations: 0,
        emergencyCases: 0,
    })
    const [loading, setLoading] = useState(true)

    const fetchData = useCallback(async () => {
        try {
            const result = await getDashboardDataAction()
            if (result.data) {
                setStats({
                    patientsToday: result.data.stats.patientsToday,
                    consultations: result.data.stats.consultations,
                    emergencyCases: result.data.stats.emergencyCases,
                })
            }
        } catch (err) {
            console.error("Error fetching doctor dashboard data:", err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchData()
    }, [fetchData])

    return (
        <div className="space-y-8">
            <PageHeader
                title="Doctor Dashboard"
                description="Your medical consultations and patient overview."
            />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="In Consultation Today" value={loading ? "â€”" : stats.patientsToday} />
                <StatCard label="Total Consultations" value={loading ? "â€”" : stats.consultations} />
                <StatCard label="In Emergency Today" value={loading ? "â€”" : stats.emergencyCases} />
                <StatCard label="Pending Reviews" value="â€”" />
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <SectionHeader title="Consultations" description="Pending and active cases" />
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Stethoscope className="size-4" /> Pending review
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Stethoscope className="size-4" /> Active consultations
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Stethoscope className="size-4" /> Completed
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <SectionHeader title="Patients" description="Student and faculty records" />
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Users className="size-4" /> Student records
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Users className="size-4" /> Faculty records
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <SectionHeader title="Incidents & Clearances" description="Medical cases" />
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <AlertTriangle className="size-4" /> Active incident cases
                        </p>
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <FileCheck className="size-4" /> Medical evaluations
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}