# ZenTraq

ZenTraq is a modern clinic management system built with Next.js and Supabase.

---

## 🚀 Local Development Guide

Follow these steps to get the project running on your local machine.

---

### 📋 Prerequisites

Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (LTS version recommended)
- [pnpm](https://pnpm.io/installation) (The primary package manager for this project)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Required for running Supabase locally)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

---

### 🛠️ Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd zentraq
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Setup Local Supabase**
   Start the Supabase local development stack (ensure Docker is running):
   ```bash
   supabase start
   ```
   This will pull the necessary images, start the database, and apply the migrations and seed data found in the `supabase/` directory.

---

### 🔐 Environment Configuration

Create a file named `.env.local` in the root directory. This file is ignored by git and is used to store your local secrets.

**Required Format:**
```env
# Supabase Configuration
# You can find these values in the terminal output after running `supabase start`
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-local-anon-key
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-local-service-role-key

# Optional: Other environment variables
# NEXT_PUBLIC_APP_ENV=development
```

> **Note:** The `NEXT_PUBLIC_` prefix allows these variables to be accessed by the browser. Be careful not to expose secret keys (like the Service Role Key) in production environments.

---

### 💻 Running the Application

Start the development server:
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

---

## 🛠 Tech Stack

- **Framework**: Next.js 16
- **Database & Auth**: Supabase
- **Styling**: Tailwind CSS 4
- **UI Components**: Shadcn UI / Lucide React
- **State/Data**: React 19

---

## 📁 Project Structure

- `app/`: Next.js App Router pages and layouts.
- `components/`: Reusable UI components.
- `supabase/`: Database migrations, seed files, and configuration.
- `utils/`: Helper functions and Supabase client configuration.

