"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { login } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { CheckCircle2, Loader2 } from "lucide-react"
import Image from "next/image"

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)
    const result = await login(formData)

    if (result?.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }

    if (result?.success) {
      router.push("/")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div
        className={`w-full max-w-md space-y-6 transition-all duration-300 ${isSuccess ? "scale-[0.99] opacity-90" : "scale-100 opacity-100"
          }`}
      >


        <Card className="border-slate-200 bg-white shadow-lg rounded-xl">
          <div className="flex flex-col items-center space-y-3 text-center">
            <Image
              src="/4.png"
              alt="Zentraq Clinic Center"
              width={200}
              height={50}
              priority
              className="h-12 w-auto object-contain"
            />
          </div>
          <form onSubmit={handleSubmit}>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Email Address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="name@example.com"
                  className="h-10 border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:ring-slate-400"
                  disabled={isLoading || isSuccess}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  className="h-10 border-slate-200 bg-white text-slate-900 focus:border-slate-400 focus:ring-slate-400"
                  disabled={isLoading || isSuccess}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pb-6 pt-3">
              <Button
                type="submit"
                className="h-10 w-full  text-white text-sm cursor-pointer font-medium transition-colors shadow-sm"
                disabled={isLoading || isSuccess}
              >
                {isSuccess ? (
                  <>
                    <CheckCircle2 className="mr-2 size-4 text-white" />
                    Success
                  </>
                ) : isLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin text-white" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
