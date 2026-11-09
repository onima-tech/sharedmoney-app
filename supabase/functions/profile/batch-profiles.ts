// deno-lint-ignore no-explicit-any
type ServiceClient = { from: (table: string) => any };

export type FetchUserEmails = (
  userIds: string[],
  currentUserId: string,
  currentUserEmail: string | null,
) => Promise<Map<string, string>>;

interface ProfileRow {
  id: string;
  full_name?: string | null;
  avatar_url?: string | null;
  phone?: string | null;
  country_code?: string | null;
  profile_completed?: boolean;
  upi_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BatchProfileResult {
  profiles: Array<ProfileRow & { email: string | null; upi_id: string | null }>;
  error: unknown | null;
}

/**
 * Viewer plus users who share a group with them where both memberships
 * are status = 'active'. Archived memberships stay active, so they are
 * included. Left (former) memberships are not.
 * Service-role profile reads bypass RLS and must use this set.
 */
async function sharedGroupUserIds(
  serviceClient: ServiceClient,
  viewerId: string,
  candidateIds: string[],
): Promise<Set<string>> {
  const allowed = new Set<string>([viewerId]);
  const others = candidateIds.filter((id) => id && id !== viewerId);
  if (others.length === 0) return allowed;

  const { data: myMemberships, error: myError } = await serviceClient
    .from('group_members')
    .select('group_id')
    .eq('user_id', viewerId)
    .eq('status', 'active');

  if (myError || !myMemberships?.length) {
    return allowed;
  }

  const groupIds = myMemberships.map((row: { group_id: string }) => row.group_id);
  const { data: coMembers, error: coError } = await serviceClient
    .from('group_members')
    .select('user_id')
    .in('group_id', groupIds)
    .in('user_id', others)
    .eq('status', 'active');

  if (coError) {
    return allowed;
  }

  for (const row of coMembers || []) {
    if (row.user_id) allowed.add(row.user_id);
  }
  return allowed;
}

/**
 * GET /profile?user_ids= batch read. Ids outside sharedGroupUserIds are
 * omitted before the profile select and before the email lookup.
 */
export async function loadBatchProfiles(
  serviceClient: ServiceClient,
  viewerId: string,
  viewerEmail: string | null,
  userIds: string[],
  fetchEmails: FetchUserEmails,
): Promise<BatchProfileResult> {
  const allowedIds = await sharedGroupUserIds(serviceClient, viewerId, userIds);
  const visibleIds = userIds.filter((id) => allowedIds.has(id));
  if (visibleIds.length === 0) {
    return { profiles: [], error: null };
  }

  const { data: profiles, error } = await serviceClient
    .from('profiles')
    .select('id, full_name, avatar_url, phone, country_code, profile_completed, upi_id, created_at, updated_at')
    .in('id', visibleIds);

  if (error) {
    return { profiles: [], error };
  }

  const emailMap = await fetchEmails(visibleIds, viewerId, viewerEmail);
  const rows = (Array.isArray(profiles) ? profiles : []) as ProfileRow[];
  const profileMap = new Map(rows.map((profile) => [profile.id, profile]));

  const enrichedProfiles = visibleIds.map((userId) => {
    const existingProfile = profileMap.get(userId);
    const email = emailMap.get(userId) || null;

    if (existingProfile) {
      return {
        ...existingProfile,
        upi_id: existingProfile.upi_id ?? null,
        email,
      };
    }

    return {
      id: userId,
      full_name: null,
      avatar_url: null,
      phone: null,
      country_code: null,
      profile_completed: false,
      upi_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email,
    };
  });

  return { profiles: enrichedProfiles, error: null };
}
