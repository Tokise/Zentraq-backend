import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { FileQuestion } from "lucide-react"

export default function NotFound() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
            <div className="flex flex-col items-center text-center max-w-md">
                <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <FileQuestion className="size-6" />
                </div>
                <h2 className="mb-2 text-lg font-semibold">Page not found</h2>
                <p className="mb-6 text-sm text-muted-foreground">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <Link
                    href="/"
                    className={buttonVariants({ variant: "default" })}
                >
                    Back to Home
                </Link>
            </div>
        </div>
    )
}