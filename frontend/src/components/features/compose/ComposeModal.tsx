import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { useCreateCampaign } from '../../../api/hooks';

const schema = z.object({
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  startAt: z.string().min(1, 'Start time is required'),
  delayMs: z.coerce.number().int().nonnegative('Delay must be ≥ 0').default(1000),
  hourlyLimit: z.coerce.number().int().positive('Hourly limit must be > 0').default(50),
});

type FormValues = z.infer<typeof schema>;

interface Lead {
  email: string;
  name?: string;
}

interface ComposeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ComposeModal({ open, onOpenChange }: ComposeModalProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [invalidCount, setInvalidCount] = useState(0);
  const createCampaign = useCreateCampaign();

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      delayMs: 1000,
      hourlyLimit: 50,
    },
  });

  const handleCsvUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvError(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const emailSet = new Set<string>();
        const valid: Lead[] = [];
        let invalid = 0;

        for (const row of result.data) {
          const email = (row['email'] ?? row['Email'] ?? '').trim().toLowerCase();
          const name = (row['name'] ?? row['Name'] ?? '').trim();
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!email || !emailRegex.test(email) || emailSet.has(email)) {
            invalid++;
            continue;
          }
          emailSet.add(email);
          valid.push({ email, name: name || undefined });
        }

        setLeads(valid);
        setInvalidCount(invalid);
        if (valid.length === 0) {
          setCsvError('No valid email addresses found in the CSV.');
        }
      },
      error: () => setCsvError('Failed to parse CSV. Make sure it has an "email" column.'),
    });
  }, []);

  const onSubmit = async (values: FormValues) => {
    if (leads.length === 0) {
      setCsvError('Please upload a CSV with at least one valid email.');
      return;
    }

    try {
      const startAt = new Date(values.startAt).toISOString();
      const result = await createCampaign.mutateAsync({
        subject: values.subject,
        body: values.body,
        startAt,
        delayMs: values.delayMs,
        hourlyLimit: values.hourlyLimit,
        leads,
      });

      toast.success(`${result.totalScheduled} emails scheduled!`, {
        description: result.skipped > 0 ? `${result.skipped} duplicates skipped.` : undefined,
      });

      reset();
      setLeads([]);
      setInvalidCount(0);
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to schedule emails. Please try again.');
    }
  };

  const handleClose = (val: boolean) => {
    if (!val) {
      reset();
      setLeads([]);
      setCsvError(null);
    }
    onOpenChange(val);
  };

  // Minimum datetime: 1 minute from now
  const minDateTime = new Date(Date.now() + 60_000)
    .toISOString()
    .slice(0, 16);

  return (
    <Modal
      open={open}
      onOpenChange={handleClose}
      title="Compose email campaign"
      description="Schedule a bulk email campaign with rate limiting."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="compose-form">
        {/* Subject */}
        <div className="form-field">
          <label htmlFor="subject" className="form-label">Subject</label>
          <input
            id="subject"
            className={`form-input ${errors.subject ? 'input-error' : ''}`}
            placeholder="Your email subject..."
            {...register('subject')}
          />
          {errors.subject && <span className="form-error">{errors.subject.message}</span>}
        </div>

        {/* Body */}
        <div className="form-field">
          <label htmlFor="body" className="form-label">Message body</label>
          <textarea
            id="body"
            rows={5}
            className={`form-input form-textarea ${errors.body ? 'input-error' : ''}`}
            placeholder="Write your email body here..."
            {...register('body')}
          />
          {errors.body && <span className="form-error">{errors.body.message}</span>}
        </div>

        {/* CSV Upload */}
        <div className="form-field">
          <label htmlFor="csv-upload" className="form-label">
            Leads CSV
            <span className="form-label-hint">(must have an "email" column)</span>
          </label>
          <div className={`csv-dropzone ${leads.length > 0 ? 'csv-loaded' : ''}`}>
            <input
              id="csv-upload"
              type="file"
              accept=".csv"
              onChange={handleCsvUpload}
              className="csv-file-input"
            />
            {leads.length === 0 ? (
              <div className="csv-placeholder">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 16V8M8 12l4-4 4 4" stroke="var(--ink-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <rect x="3" y="3" width="18" height="18" rx="4" stroke="var(--line)" strokeWidth="1.5"/>
                </svg>
                <span>Click to upload CSV</span>
              </div>
            ) : (
              <div className="csv-summary">
                <span className="csv-count-valid">✓ {leads.length} valid leads</span>
                {invalidCount > 0 && (
                  <span className="csv-count-invalid">{invalidCount} skipped (invalid/duplicate)</span>
                )}
              </div>
            )}
          </div>
          {csvError && <span className="form-error">{csvError}</span>}
        </div>

        <div className="compose-row">
          {/* Start time */}
          <div className="form-field">
            <label htmlFor="startAt" className="form-label">Start time</label>
            <input
              id="startAt"
              type="datetime-local"
              min={minDateTime}
              className={`form-input ${errors.startAt ? 'input-error' : ''}`}
              {...register('startAt')}
            />
            {errors.startAt && <span className="form-error">{errors.startAt.message}</span>}
          </div>

          {/* Delay */}
          <div className="form-field">
            <label htmlFor="delayMs" className="form-label">
              Delay between sends
              <span className="form-label-hint">(ms)</span>
            </label>
            <input
              id="delayMs"
              type="number"
              min="0"
              className={`form-input ${errors.delayMs ? 'input-error' : ''}`}
              {...register('delayMs')}
            />
            {errors.delayMs && <span className="form-error">{errors.delayMs.message}</span>}
          </div>

          {/* Hourly limit */}
          <div className="form-field">
            <label htmlFor="hourlyLimit" className="form-label">Hourly limit</label>
            <input
              id="hourlyLimit"
              type="number"
              min="1"
              className={`form-input ${errors.hourlyLimit ? 'input-error' : ''}`}
              {...register('hourlyLimit')}
            />
            {errors.hourlyLimit && <span className="form-error">{errors.hourlyLimit.message}</span>}
          </div>
        </div>

        <div className="compose-footer">
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleClose(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            loading={createCampaign.isPending}
            disabled={leads.length === 0}
            id="schedule-btn"
          >
            Schedule {leads.length > 0 ? `${leads.length} emails` : 'emails'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
