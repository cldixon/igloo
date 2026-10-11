/**
 * The igloo lexicon, shared by the instance and the AppView.
 *
 * Phase 1 uses the prototype namespace `dev.cldixon.igloo.*`. At the reset
 * point the network restarts under `social.igloo.*`; changing NAMESPACE here is
 * meant to be the only code change that move needs.
 */
export const NAMESPACE = "dev.cldixon.igloo";

export const NSID = {
  /** Record announcing a data dir and its file hashes. rkey = data dir slug. */
  dataDir: `${NAMESPACE}.dataDir`,
  /** Record naming and describing an instance. rkey = instance domain. */
  instance: `${NAMESPACE}.instance`,
  /** XRPC method an instance calls on the AppView after publishing. */
  notifyRecord: `${NAMESPACE}.notifyRecord`,
} as const;

/** Record collections the AppView subscribes to on Jetstream. */
export const COLLECTIONS = [NSID.dataDir, NSID.instance] as const;
