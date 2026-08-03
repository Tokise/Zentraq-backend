import { PageHeader } from "@/components/page-header"
import { ProgramForm } from "@/components/health-program/program-form"
import { createHealthProgram, getHealthPrograms } from "@/app/actions/health-programs"
import { toast } from "sonner"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Syringe, Activity, Heart, Plus } from "lucide-react"

export default async function HealthProgramsPage() {
  const { programs } = await getHealthPrograms()

  const programTypeIcons = {
    immunization: Syringe,
    screening: Activity,
    wellness: Heart
  }

  const programTypeColors = {
    immunization: "text-blue-600",
    screening: "text-green-600",
    wellness: "text-pink-600"
  }

  return (
    <main className="space-y-6">
      <PageHeader
        title="Health Programs"
        description="Manage health programs including immunizations, screenings, and wellness activities."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active Programs</h2>
          </div>

          {programs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No health programs created yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {programs.map((program: any) => {
                const Icon = programTypeIcons[program.program_type as keyof typeof programTypeIcons]
                return (
                  <Card key={program.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-5 w-5 ${programTypeColors[program.program_type as keyof typeof programTypeColors]}`} />
                          <CardTitle className="text-base">{program.name}</CardTitle>
                        </div>
                        <Badge variant={program.is_active ? "default" : "secondary"}>
                          {program.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {program.description || "No description"}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {program.start_date && (
                          <span>Start: {new Date(program.start_date).toLocaleDateString()}</span>
                        )}
                        {program.end_date && (
                          <span>End: {new Date(program.end_date).toLocaleDateString()}</span>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-3"
                        onClick={() => redirect(`/admin/services/programs?programId=${program.id}`)}
                      >
                        Manage Program
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <ProgramForm
            onSubmit={async (data) => {
              "use server"
              const result = await createHealthProgram(data)
              if (result.error) {
                toast.error(result.error)
                throw new Error(result.error)
              }
              redirect("/admin/services/programs")
            }}
          />
        </div>
      </div>
    </main>
  )
}
