"use client"

import * as React from "react"
import { login } from "@/app/login/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { LockKeyhole } from "lucide-react"

export default function LoginPage() {
  const [isLoading, setIsLoading] = React.useState(false)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsLoading(true)
    try {
      const formData = new FormData(event.currentTarget)
      const result = await login(formData)

      if (result?.error) {
        toast.error(result.error)
        setIsLoading(false)
      }
    } catch (err) {
      toast.error("An unexpected error occurred");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center justify-center space-y-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <LockKeyhole className="size-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Welcome Back</h1>
          <p className="text-sm text-muted-foreground">
            Enter your credentials to access your clinic dashboard
          </p>
        </div>
        
        <Card className="border-none shadow-xl">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold text-center">Sign In</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-sm font-medium">Email Address</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  className="h-11"
                  required 
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  
                </div>
                <Input 
                  id="password" 
                  name="password" 
                  type="password" 
                  className="h-11"
                  required 
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pb-6 mt-5">
              <Button 
                type="submit" 
                className="w-full h-11 text-base font-medium transition-all cursor-pointer active:scale-95" 
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
