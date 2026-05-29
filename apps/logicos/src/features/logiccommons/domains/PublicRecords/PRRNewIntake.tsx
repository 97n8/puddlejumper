import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useCommonsContext } from '../../hooks/useCommonsContext'
import { useCreateIntakeRecord } from '../../hooks/useIntakeRecord'

const PRRSchema = z.object({
  requester_name:      z.string().min(1, 'Required'),
  requester_email:     z.string().email('Invalid email').optional().or(z.literal('')),
  request_description: z.string().min(10, 'Describe the records being requested'),
  intake_channel:      z.enum(['form', 'email', 'phone', 'in_person']),
  department_id:       z.string().min(1, 'Required'),
})

type PRRFormData = z.infer<typeof PRRSchema>

export function PRRNewIntake() {
  const navigate = useNavigate()
  const { data: ctx } = useCommonsContext()
  const createRecord = useCreateIntakeRecord()
  const departments = ctx?.org_chart?.departments ?? []

  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<PRRFormData>({
    resolver: zodResolver(PRRSchema),
    defaultValues: { intake_channel: 'form' },
  })

  const onSubmit = async (data: PRRFormData) => {
    try {
      await createRecord.mutateAsync({
        record_type: 'public_records_request',
        module_key: 'VAULTCLERK.PublicRecords',
        intake_channel: data.intake_channel,
        requester_name: data.requester_name,
        requester_email: data.requester_email || null,
        request_description: data.request_description,
        department_id: data.department_id,
      })
      navigate('/commons/public-records')
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Submission failed' })
    }
  }

  return (
    <div className="p-6 max-w-xl">
      <h3 className="text-lg font-bold mb-4">New Public Records Request</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="text-sm font-medium">Requester Name</label>
          <input
            {...register('requester_name')}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Full name"
          />
          {errors.requester_name && <p className="text-xs text-red-600 mt-1">{errors.requester_name.message}</p>}
        </div>

        <div>
          <label className="text-sm font-medium">
            Requester Email <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input
            {...register('requester_email')}
            type="email"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="email@example.com"
          />
          {errors.requester_email && <p className="text-xs text-red-600 mt-1">{errors.requester_email.message}</p>}
        </div>

        <div>
          <label className="text-sm font-medium">Request Description</label>
          <textarea
            {...register('request_description')}
            rows={3}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
            placeholder="Describe the records being requested..."
          />
          {errors.request_description && <p className="text-xs text-red-600 mt-1">{errors.request_description.message}</p>}
        </div>

        <div>
          <label className="text-sm font-medium">Intake Channel</label>
          <select
            {...register('intake_channel')}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="form">Web Form</option>
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="in_person">In Person</option>
          </select>
          {errors.intake_channel && <p className="text-xs text-red-600 mt-1">{errors.intake_channel.message}</p>}
        </div>

        <div>
          <label className="text-sm font-medium">Responsible Department</label>
          <select
            {...register('department_id')}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Select department...</option>
            {departments.map((d: { id: string; name: string }) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          {errors.department_id && <p className="text-xs text-red-600 mt-1">{errors.department_id.message}</p>}
        </div>

        {errors.root && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md border border-red-200">{errors.root.message}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={isSubmitting || createRecord.isPending}
            className="px-4 py-2 text-sm font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isSubmitting || createRecord.isPending ? 'Submitting...' : 'Submit Request'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/commons/public-records')}
            className="px-4 py-2 text-sm font-medium rounded-md border border-border hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
