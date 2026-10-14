import { validSession, itemsForStep, type Session, type Step } from './experiment.ts';
import { validSession as validV6, itemsForStep as itemsV6 } from './archive-v6/experiment.ts';
import { normalizeProfile } from './profile.ts';

// Historical records are read/export only; never migrate answers into new tasks.
export function validResearchSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object' || !('profile' in value)) return false;
  const candidate = structuredClone(value) as Session;
  candidate.profile = normalizeProfile(candidate.profile);
  return validSession(candidate) || validV6(candidate);
}
export function researchItems(session: Session, step: Step) {
  return session.protocolVersion === 'E2-local-demo-20260911-v6' ? itemsV6(step) : itemsForStep(step);
}
