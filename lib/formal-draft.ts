import { validSession, type Session } from './experiment.ts';

const key = (session: Session) => `ier-e2-page-draft:${session.id}`;

// A recovery copy for the current browser tab; submitted data remains in the database.
export function cacheFormalDraft(storage: Storage, session: Session) {
  storage.setItem(key(session), JSON.stringify(session));
}

export function restoreFormalDraft(storage: Storage, saved: Session): Session {
  try {
    const draft: unknown = JSON.parse(storage.getItem(key(saved)) ?? 'null');
    if (validSession(draft) && draft.mode === 'formal' && draft.id === saved.id
      && draft.revision === saved.revision && draft.sequence === saved.sequence
      && draft.seed === saved.seed && draft.profile.participantId === saved.profile.participantId) return draft;
  } catch { /* The server record is the fallback for an unavailable or invalid cache. */ }
  return saved;
}

export function clearFormalDraft(storage: Storage, session: Session) {
  storage.removeItem(key(session));
}
