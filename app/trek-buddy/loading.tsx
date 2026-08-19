import { TodayLoading } from '@/components/trek/ui/PageSkeletons'

// Today, not the board — this route stopped being the board when the front
// door split in two, and the old skeleton was still drawing a filter rail and
// a day arc that no longer land here.
export default function Loading() {
  return <TodayLoading />
}
