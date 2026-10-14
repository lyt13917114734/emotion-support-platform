import type { Session } from './experiment.ts';
import type { SessionRepository } from './storage.ts';
import { exportProfile } from './profile.ts';

// Retry the exact candidate, preserving the original send timestamp and draft.
export class PendingSave {
  candidate: Session;
  expectedRevision: number;
  constructor(candidate: Session, expectedRevision: number) {
    this.candidate = candidate; this.expectedRevision = expectedRevision;
  }
  retry(repository: SessionRepository) { return repository.save(this.candidate, this.expectedRevision); }
  backup() { return JSON.stringify({ ...this.candidate, profile: exportProfile(this.candidate.profile), emergencyBackup: { persisted: false, expectedRevision: this.expectedRevision } }, null, 2); }
}
