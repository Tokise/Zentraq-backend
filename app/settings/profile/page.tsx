import { PageHeader } from "@/components/common/page-header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function SettingsProfilePage() {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Profile Settings"
                description="Update your name, photo, and contact information."
            />
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-semibold">Profile Information</CardTitle>
                    <CardDescription className="text-xs">
                        Profile management will be available in a future release.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                    Coming soon.
                </CardContent>
            </Card>
        </div>
    )
}