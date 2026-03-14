import { Sidebar } from './Sidebar'
import { Header } from './Header'

interface DashboardShellProps {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="pl-16 lg:pl-56 min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
