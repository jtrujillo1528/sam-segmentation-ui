import dynamic from 'next/dynamic'

const SAMSegmentationUI = dynamic(() => import('../../components/SAMSegmentationUI'), { ssr: false })

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <SAMSegmentationUI />
    </main>
  )
}