import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-accent animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }

export function MapSkeleton() {
  return (
    <div className="h-[calc(100vh-48px)] mt-12 flex">
      <div className="flex-1 relative bg-[#0d1520] p-6">
        <div className="h-full flex flex-col items-center justify-center space-y-6">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="w-full max-w-2xl h-4" />
          ))}
          <div className="flex space-x-4 mt-8">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="w-32 h-32 rounded-lg" />
            ))}
          </div>
          <Skeleton className="w-96 h-6 mt-8" />
          <Skeleton className="w-64 h-4 mt-4" />
        </div>

        <div className="absolute top-4 left-4">
          <Skeleton className="w-40 h-10 rounded-lg" />
        </div>

        <div className="absolute bottom-4 left-4">
          <Skeleton className="w-48 h-8 rounded-lg" />
        </div>
      </div>

      <div className="w-[280px] bg-[#111827] border-l border-[#1f2937] p-4 space-y-4">
        <Skeleton className="w-full h-12 rounded-lg" />
        <Skeleton className="w-full h-12 rounded-lg" />
        <Skeleton className="w-full h-10 rounded-lg" />
        <Skeleton className="w-full h-32 rounded-lg mt-8" />
        <Skeleton className="w-full h-32 rounded-lg mt-4" />
      </div>
    </div>
  )
}

export function ReportCardSkeleton() {
  return (
    <div className="bg-[#111827] rounded-xl p-4 border-l-4 border-l-[#1f2937]">
      <div className="flex items-start justify-between mb-3">
        <Skeleton className="w-64 h-5 rounded" />
        <Skeleton className="w-24 h-6 rounded-full" />
      </div>
      <Skeleton className="w-full h-4 rounded mb-2" />
      <Skeleton className="w-3/4 h-4 rounded mb-3" />
      <div className="flex items-center justify-between">
        <Skeleton className="w-32 h-3 rounded" />
        <Skeleton className="w-16 h-6 rounded" />
      </div>
    </div>
  )
}

export function ReportsListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {[...Array(count)].map((_, i) => (
        <ReportCardSkeleton key={i} />
      ))}
    </div>
  )
}
