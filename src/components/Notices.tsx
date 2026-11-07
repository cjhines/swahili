import { useState } from 'react';

import { dismissInstallNudge, shouldNudgeInstall } from '../pwa/install.ts';
import { applyWaitingUpdate, useUpdateWaiting } from '../pwa/updates.ts';

/** iOS's Share symbol, so the instruction matches what's on screen. */
const ShareIcon = () => (
  <svg
    className="inline-icon"
    viewBox="0 0 24 24"
    aria-hidden="true"
    width="1.1em"
    height="1.1em"
  >
    <path
      d="M12 3v12M7.5 7.5 12 3l4.5 4.5M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Shown on the setup screen only, never during a session. */
export const Notices = () => {
  const updateWaiting = useUpdateWaiting();
  const [nudge, setNudge] = useState(() => shouldNudgeInstall(new Date()));

  return (
    <>
      {updateWaiting && (
        <section className="notice" aria-label="Update available">
          <p>
            <strong>A new version is ready.</strong>
            <span className="muted">
              It takes a second and keeps all your progress.
            </span>
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={applyWaitingUpdate}
          >
            Update now
          </button>
        </section>
      )}
      {nudge && (
        <section className="notice" aria-label="Add to Home Screen">
          <p>
            <strong>Add this app to your Home Screen</strong>
            <span className="muted">
              Safari clears a site&apos;s saved progress after 7 days without a
              visit. Home Screen apps keep it. Tap <ShareIcon /> <b>Share</b>,
              then <b>Add to Home Screen</b>.
            </span>
          </p>
          <button
            type="button"
            className="btn btn-quiet"
            onClick={() => {
              dismissInstallNudge(new Date());
              setNudge(false);
            }}
          >
            Not now
          </button>
        </section>
      )}
    </>
  );
};
