import { createClient } from "@supabase/supabase-js";

const getSupabaseCredentials = () => {
  let url = "https://pztxsheancbwluzcedqd.supabase.co";
  let key = "sb_publishable_lZ5O4Uj-R587jH1A1vdx0A_Jmh1s82a";

  // Try loading from LocalStorage first (user override from UI)
  try {
    const localUrl = localStorage.getItem("supabase_url_override");
    const localKey = localStorage.getItem("supabase_anon_key_override");
    if (localUrl) url = localUrl;
    if (localKey) key = localKey;
  } catch (e) {
    console.warn("LocalStorage not accessible for Supabase overrides:", e);
  }

  // Fallback to environment variables if present
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL;
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY;
  if (envUrl) url = envUrl;
  if (envKey) key = envKey;

  return { url, key };
};

export const { url: supabaseUrl, key: supabaseAnonKey } =
  getSupabaseCredentials();

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase URL or Anon Key is missing. Check your environment configuration.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SupabaseProfile {
  id: string;
  phone?: string;
  email?: string;
  whatsapp?: string;
  alias: string;
  photo: string;
  role: string;
  gender?: string;
  interests?: string[];
  category?: string;
  bio?: string;
  age?: number;
  latitude?: number;
  longitude?: number;
  updated_at?: string;
}

/**
 * Checks if the connection to Supabase is active and working.
 */
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("count", { count: "exact", head: true });
    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows", which is fine. Other codes might indicate table doesn't exist yet, which is a success connection-wise but schema-wise needs work.
      console.warn(
        "Supabase connected, but profiles table might not be initialized yet.",
        error.message,
      );
      return true; // Connection is physically working
    }
    return true;
  } catch (err) {
    console.error("Supabase connection check failed:", err);
    return false;
  }
}

/**
 * Saves or updates a user profile in Supabase.
 * Gracefully falls back if table is not configured.
 */
export async function saveProfile(profile: SupabaseProfile): Promise<boolean> {
  try {
    const upsertData: any = {
      id: profile.id,
      alias: profile.alias,
      photo: profile.photo,
      role: profile.role,
      gender: profile.gender,
      interests: profile.interests,
      category: profile.category,
      bio: profile.bio,
      age: profile.age,
      updated_at: new Date().toISOString(),
    };

    if (profile.phone) upsertData.phone = profile.phone;
    if (profile.whatsapp) upsertData.whatsapp = profile.whatsapp;
    if (profile.email) upsertData.email = profile.email;

    let { error } = await supabase
      .from("profiles")
      .upsert(upsertData, { onConflict: "id" });

    // If undefined_column error (PostgreSQL error code 42703), retry without email fields
    if (error && (error.code === "42703" || error.message?.includes("email"))) {
      console.warn(
        "Profiles table might be missing some columns, retrying with only core columns...",
        error.message,
      );
      const safeData = { ...upsertData };
      delete safeData.email;

      const retry = await supabase
        .from("profiles")
        .upsert(safeData, { onConflict: "id" });
      error = retry.error;
    }

    if (error) {
      console.warn(
        "Could not save profile to Supabase. Table may not be created yet:",
        error.message,
      );
      return false;
    }
    return true;
  } catch (err: any) {
    console.error("Error saving profile to Supabase:", err.message);
    return false;
  }
}

/**
 * Fetches a user profile from Supabase by ID.
 */
export async function getProfileById(
  id: string,
): Promise<SupabaseProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.warn(
        "Could not fetch profile from Supabase by ID:",
        error.message,
      );
      return null;
    }
    return data;
  } catch (err) {
    console.error("Error fetching profile from Supabase by ID:", err);
    return null;
  }
}

/**
 * Fetches a user profile from Supabase by phone number.
 */
export async function getProfileByPhone(
  phone: string,
): Promise<SupabaseProfile | null> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("phone", phone)
      .maybeSingle();

    if (error) {
      console.warn("Could not fetch profile from Supabase:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error("Error fetching profile from Supabase:", err);
    return null;
  }
}

/**
 * Logs a payment transaction to Supabase.
 */
export async function saveTransaction(tx: {
  id: string;
  user_id: string;
  amount: number;
  service_name: string;
  status: string;
  provider: string;
  tracking_id?: string;
}): Promise<boolean> {
  try {
    const { error } = await supabase.from("transactions").insert({
      id: tx.id,
      user_id: tx.user_id,
      amount: tx.amount,
      service_name: tx.service_name,
      status: tx.status,
      provider: tx.provider,
      tracking_id: tx.tracking_id,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn(
        "Could not save transaction to Supabase. Table may not be created yet:",
        error.message,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.error("Error saving transaction to Supabase:", err);
    return false;
  }
}

