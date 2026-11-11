import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { CalendarClock, CheckCircle2, XCircle } from 'lucide-react';
import { platformService } from '@/services/platformService';

const appointmentSchema = z.object({
  contact_name: z.string().min(2, 'Contact name is required'),
  phone: z.string().min(10, 'Valid phone number required'),
  title: z.string().min(2, 'Title is required'),
  scheduled_start: z.string().min(5, 'Start time is required'),
  scheduled_end: z.string().min(5, 'End time is required'),
  notes: z.string().optional(),
});

type AppointmentForm = z.infer<typeof appointmentSchema>;

interface AppointmentRow {
  id: string;
  contact_name: string;
  phone: string;
  title: string;
  scheduled_start: string;
  status: string;
}

const columnHelper = createColumnHelper<AppointmentRow>();

export const AppointmentsPanel: React.FC = () => {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => platformService.listAppointments(),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      title: 'Site Visit / Consultation',
      scheduled_start: '2026-11-15T11:00:00+05:30',
      scheduled_end: '2026-11-15T11:30:00+05:30',
    },
  });

  const createMut = useMutation({
    mutationFn: platformService.createAppointment,
    onSuccess: () => {
      setFeedback('Appointment scheduled successfully.');
      reset();
      qc.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (err: any) => setFeedback(err.message),
  });

  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      platformService.updateAppointment(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const columns = useMemo(
    () => [
      columnHelper.accessor('contact_name', { header: 'Contact' }),
      columnHelper.accessor('phone', { header: 'Phone' }),
      columnHelper.accessor('title', { header: 'Meeting' }),
      columnHelper.accessor('scheduled_start', { header: 'Start (IST)' }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-800">
            {info.getValue()}
          </span>
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => statusMut.mutate({ id: row.original.id, status: 'completed' })}
              className="p-1 text-emerald-700 hover:bg-emerald-50 rounded cursor-pointer"
              title="Mark Completed"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => statusMut.mutate({ id: row.original.id, status: 'cancelled' })}
              className="p-1 text-rose-700 hover:bg-rose-50 rounded cursor-pointer"
              title="Cancel"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        ),
      }),
    ],
    [statusMut]
  );

  const tableData: AppointmentRow[] = data?.appointments || [];
  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl p-6 border border-slate-200/90">
        <div className="flex items-center gap-2 text-xs font-semibold text-orange-700 mb-1">
          <CalendarClock className="w-4 h-4" />
          <span>Smart Appointment Manager (Atomic Slot Lock + Google Calendar Sync)</span>
        </div>
        <h1 className="font-display text-2xl font-extrabold text-slate-900">Appointments</h1>
      </div>

      {feedback && (
        <div className="px-4 py-3 rounded-2xl bg-slate-900 text-white text-xs font-medium">{feedback}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSubmit((vals) => createMut.mutate(vals))}
          className="lg:col-span-4 bg-white rounded-3xl p-6 border border-slate-200/90 space-y-3 text-xs"
        >
          <h2 className="text-sm font-bold text-slate-900">Book Slot</h2>
          <div>
            <input {...register('contact_name')} placeholder="Contact Name" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            {errors.contact_name && <p className="text-rose-600 mt-1">{errors.contact_name.message}</p>}
          </div>
          <div>
            <input {...register('phone')} placeholder="+919848012345" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
            {errors.phone && <p className="text-rose-600 mt-1">{errors.phone.message}</p>}
          </div>
          <div>
            <input {...register('title')} placeholder="Consultation Title" className="w-full px-3 py-2 rounded-xl border border-slate-200" />
          </div>
          <div>
            <input {...register('scheduled_start')} placeholder="ISO Start" className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono" />
          </div>
          <div>
            <input {...register('scheduled_end')} placeholder="ISO End" className="w-full px-3 py-2 rounded-xl border border-slate-200 font-mono" />
          </div>
          <button
            type="submit"
            disabled={createMut.isPending}
            className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold cursor-pointer"
          >
            {createMut.isPending ? 'Booking...' : 'Reserve Slot'}
          </button>
        </form>

        <div className="lg:col-span-8 bg-white rounded-3xl p-6 border border-slate-200/90 overflow-x-auto">
          {isLoading ? (
            <div className="py-10 text-center text-xs text-slate-400">Loading appointments...</div>
          ) : tableData.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">No appointments booked yet.</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-slate-200 text-slate-500">
                    {hg.headers.map((h) => (
                      <th key={h.id} className="py-2 pr-3 font-semibold">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-3 pr-3 text-slate-800">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

