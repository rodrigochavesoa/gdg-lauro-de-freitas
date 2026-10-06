import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCommunityAvatarHandler } from "./handler.js";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const allowedOrigins = (Deno.env.get("COMMUNITY_AVATAR_ALLOWED_ORIGINS") ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("community-avatar environment is incomplete");
}

const authClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const privilegedClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const handler = createCommunityAvatarHandler({
  allowedOrigins,
  verifyAccessToken: async (token: string) => authClient.auth.getUser(token),
  getPrivateAvatarPath: async (publicId: string, subjectId: string) =>
    privilegedClient.rpc("community_avatar_storage_path", {
      p_public_id: publicId,
      p_viewer_id: subjectId,
    }),
  downloadPrivateAvatar: async (path: string) => {
    const encodedPath = path.split("/").map(encodeURIComponent).join("/");
    return fetch(`${supabaseUrl}/storage/v1/object/authenticated/avatars/${encodedPath}`, {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
    });
  },
});

Deno.serve(handler);
