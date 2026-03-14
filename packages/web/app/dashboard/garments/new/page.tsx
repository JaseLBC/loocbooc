import { GarmentUploadWizard } from '@/components/garments/GarmentUploadWizard'

export const metadata = {
  title: 'Add Garment',
}

export default function NewGarmentPage() {
  return (
    <div className="py-4">
      <GarmentUploadWizard />
    </div>
  )
}
