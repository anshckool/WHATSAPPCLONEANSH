import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing authorization header." }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client with the caller's JWT so we can read auth.uid()
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: authData, error: authErr } = await userClient.auth.getUser(token);
    if (authErr || !authData.user) {
      return json({ error: "Invalid or expired token." }, 401);
    }
    const myId = authData.user.id;
    const myEmail = authData.user.email;
    if (!myEmail) {
      return json({ error: "Your account has no email." }, 400);
    }

    const body = await req.json().catch(() => ({}));
    const inviteEmail: string | undefined = body.inviteEmail;
    if (!inviteEmail || !inviteEmail.includes("@")) {
      return json({ error: "A valid inviteEmail is required." }, 400);
    }
    const targetEmail = inviteEmail.trim().toLowerCase();
    if (targetEmail === myEmail.toLowerCase()) {
      return json({ error: "You cannot connect with yourself." }, 400);
    }

    // Service-role client so we can read any profile + insert contacts.
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Load my profile and the inviter's profile by email.
    const { data: myProfile } = await admin
      .from("profiles")
      .select("id, email, name, avatar_color")
      .eq("id", myId)
      .maybeSingle();

    const { data: targetProfile } = await admin
      .from("profiles")
      .select("id, email, name, avatar_color")
      .eq("email", targetEmail)
      .maybeSingle();

    if (!myProfile) {
      return json({ error: "Your profile is not set up yet." }, 400);
    }

    const targetId = targetProfile?.id ?? null;
    const results: string[] = [];

    // 1. Add THEM to MY contacts (if not already there)
    const { data: existingMine } = await admin
      .from("contacts")
      .select("id")
      .eq("owner_id", myId)
      .eq("contact_email", targetEmail)
      .maybeSingle();

    if (!existingMine) {
      const { error: e1 } = await admin.from("contacts").insert({
        owner_id: myId,
        contact_profile_id: targetId,
        contact_email: targetEmail,
        contact_name: targetProfile?.name ?? null,
        username: targetEmail,
        avatar_color: targetProfile?.avatar_color ?? "blue",
      });
      if (e1) results.push(`my-contact: ${e1.message}`);
      else results.push("my-contact: created");
    } else {
      results.push("my-contact: already-exists");
    }

    // 2. Add ME to THEIR contacts (reverse direction) — only if they're registered
    if (targetId) {
      const { data: existingTheirs } = await admin
        .from("contacts")
        .select("id")
        .eq("owner_id", targetId)
        .eq("contact_email", myEmail.toLowerCase())
        .maybeSingle();

      if (!existingTheirs) {
        const { error: e2 } = await admin.from("contacts").insert({
          owner_id: targetId,
          contact_profile_id: myId,
          contact_email: myEmail.toLowerCase(),
          contact_name: myProfile.name ?? null,
          username: myEmail.toLowerCase(),
          avatar_color: myProfile.avatar_color ?? "blue",
        });
        if (e2) results.push("their-contact: " + e2.message);
        else results.push("their-contact: created");
      } else {
        results.push("their-contact: already-exists");
      }
    }

    return json({
      ok: true,
      connected: !!targetProfile,
      partner: targetProfile
        ? {
            id: targetProfile.id,
            name: targetProfile.name,
            email: targetProfile.email,
            avatar_color: targetProfile.avatar_color,
          }
        : null,
      results,
    }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return json({ error: message }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
