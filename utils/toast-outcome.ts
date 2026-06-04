import type { StepStatus } from './html-step-report';

export type SectionOverall = 'passed' | 'failed' | 'incomplete';

/** Toast / upload feedback status used across page objects and specs. */
export type ToastLikeStatus = 'success' | 'failed' | 'none' | 'neutral';

/**
 * Maps toaster outcome to report step badge:
 * - error / red toaster → failed
 * - success / green toaster → success
 * - no toaster → defaultForNone
 */
export function toastToStepStatus(
  status: ToastLikeStatus,
  defaultForNone: StepStatus = 'neutral',
): StepStatus {
  if (status === 'failed') return 'failed';
  if (status === 'success') return 'success';
  return defaultForNone;
}

export function isToastFailure(status: ToastLikeStatus): boolean {
  return status === 'failed';
}

export function isToastSuccess(status: ToastLikeStatus): boolean {
  return status === 'success';
}

export interface ToastStepInput {
  screenshot?: Buffer | null;
  status: ToastLikeStatus;
  message?: string;
}

/** Builds step title with optional toaster message. */
export function toastStepTitle(title: string, message?: string, includeMessage = true): string {
  if (includeMessage && message?.trim()) return `${title} — ${message.trim()}`;
  return title;
}
