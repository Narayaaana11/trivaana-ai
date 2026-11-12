import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LandingPage } from '@/components/landing/LandingPage';
import { PricingSection } from '@/components/landing/PricingSection';
import { TestimonialsAndFaqSection } from '@/components/landing/TestimonialsAndFaqSection';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { Dialog } from '@/components/ui/Dialog';
import { MotionConfig } from 'framer-motion';

function ToastTrigger() {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() => toast({ type: 'success', title: 'Saved cleanly', description: 'All changes synced.' })}
    >
      Trigger Toast
    </button>
  );
}

describe('Trivaana UI Modernization & Design System', () => {
  it('renders FeaturesBentoSection, Testimonials, and interactive FAQ Accordion on LandingPage', () => {
    render(
      <MotionConfig reducedMotion="user">
        <LandingPage
          onEnterDashboard={vi.fn()}
          onOpenSimulator={vi.fn()}
        />
      </MotionConfig>
    );

    expect(screen.getByText(/Everything an autonomous AI calling team needs/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Sub-30s Instant Speed-to-Lead/i })).toBeInTheDocument();
    expect(screen.getByText(/Trusted by high-velocity Indian teams/i)).toBeInTheDocument();
    expect(screen.getByText(/Clear answers before you launch/i)).toBeInTheDocument();

    const faqBtn = screen.getByRole('button', {
      name: /Which Indian languages and accents are supported\?/i,
    });
    expect(faqBtn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(faqBtn);
    expect(faqBtn).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/Sarvam AI \(Bulbul v3\)/i)).toBeInTheDocument();
  });

  it('toggles Monthly vs Annual billing in PricingSection with 20% discount', () => {
    render(
      <MotionConfig reducedMotion="user">
        <PricingSection onEnterDashboard={vi.fn()} />
      </MotionConfig>
    );

    expect(screen.getByText('2,999')).toBeInTheDocument();
    const annualTab = screen.getByRole('tab', { name: /Annual Billing/i });
    fireEvent.click(annualTab);
    expect(screen.getByText('2,399')).toBeInTheDocument();
  });

  it('triggers accessible Toast notifications and Dialog open/close', () => {
    const onClose = vi.fn();
    render(
      <MotionConfig reducedMotion="user">
        <ToastProvider>
          <ToastTrigger />
          <Dialog open={true} onClose={onClose} title="Test Modal">
            <p>Modal body</p>
          </Dialog>
        </ToastProvider>
      </MotionConfig>
    );

    fireEvent.click(screen.getByText('Trigger Toast'));
    expect(screen.getByText('Saved cleanly')).toBeInTheDocument();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Close dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
