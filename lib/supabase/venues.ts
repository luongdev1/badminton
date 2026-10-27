import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export async function getOrCreateTeamVenue(
  supabase: SupabaseClient<Database>,
  teamId: string,
  name: string,
) {
  const normalizedName = name.trim();
  const nameKey = normalizedName.toLowerCase();
  const { data: existing, error: existingError } = await supabase
    .from("team_venues")
    .select("id")
    .eq("team_id", teamId)
    .eq("name_key", nameKey)
    .maybeSingle();

  if (existingError) throw new Error(`Could not look up the team venue: ${existingError.message}`);
  if (existing) return existing.id;

  const { data: created, error: createError } = await supabase
    .from("team_venues")
    .insert({ team_id: teamId, name: normalizedName })
    .select("id")
    .single();

  if (!createError) return created.id;
  if (createError.code !== "23505") throw new Error(`Could not save the team venue: ${createError.message}`);

  const { data: racedVenue, error: retryError } = await supabase
    .from("team_venues")
    .select("id")
    .eq("team_id", teamId)
    .eq("name_key", nameKey)
    .maybeSingle();

  if (retryError) throw new Error(`Could not resolve a concurrently created venue: ${retryError.message}`);
  if (!racedVenue) throw new Error("Venue was concurrently created but could not be loaded.");
  return racedVenue.id;
}
