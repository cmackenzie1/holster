import { HeadContent, Outlet, Scripts, createRootRoute, Link, useRouter, ErrorComponentProps } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { FileQuestion, AlertTriangle, Home, RefreshCw } from 'lucide-react'

import Header from '../components/Header'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Paperless',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFoundPage,
  errorComponent: ErrorPage,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  return (
    <Header>
      <Outlet />
    </Header>
  )
}

function NotFoundPage() {
  return (
    <Header>
      <div className="min-h-full flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-slate-800 border border-slate-700 mb-6">
              <FileQuestion className="w-12 h-12 text-slate-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">404</h1>
            <h2 className="text-xl font-semibold text-slate-300 mb-4">Page Not Found</h2>
            <p className="text-slate-400 mb-8">
              The page you're looking for doesn't exist or may have been moved.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
            >
              <Home className="w-5 h-5" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </Header>
  )
}

function ErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter()

  const handleRetry = () => {
    reset()
    router.invalidate()
  }

  return (
    <Header>
      <div className="min-h-full flex items-center justify-center px-4">
        <div className="text-center max-w-lg">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-red-500/10 border border-red-500/30 mb-6">
              <AlertTriangle className="w-12 h-12 text-red-400" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2">Oops!</h1>
            <h2 className="text-xl font-semibold text-slate-300 mb-4">Something went wrong</h2>
            <p className="text-slate-400 mb-6">
              An unexpected error occurred. Please try again or return to the dashboard.
            </p>
            {error?.message && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 text-left mb-8">
                <p className="text-sm text-slate-400 mb-1">Error details:</p>
                <code className="text-sm text-red-400 break-all">{error.message}</code>
              </div>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
            <Link
              to="/"
              onClick={() => reset()}
              className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-lg transition-colors"
            >
              <Home className="w-5 h-5" />
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </Header>
  )
}
