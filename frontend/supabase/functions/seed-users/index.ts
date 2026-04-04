import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ClientInput {
  email: string;
  password: string;
}

interface SeedRequest {
  admin_email: string;
  admin_password: string;
  clients: ClientInput[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: SeedRequest = await req.json();
    const { admin_email, admin_password, clients } = body;

    // Validate required fields
    if (!admin_email || !admin_password) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: admin_email, admin_password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(admin_email)) {
      return new Response(
        JSON.stringify({ error: "Invalid admin email format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate password strength
    if (admin_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Admin password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const results: { admin?: any; clients: any[]; errors: string[] } = { clients: [], errors: [] };

    // Create admin user
    console.log("Creating admin user:", admin_email);
    const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });

    if (adminError) {
      console.error("Admin creation error:", adminError);
      results.errors.push(`Admin user: ${adminError.message}`);
    } else if (adminData.user) {
      console.log("Admin user created:", adminData.user.id);
      
      // Verify and set admin role
      const { data: existingAdminRole } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", adminData.user.id)
        .single();

      if (!existingAdminRole) {
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({ user_id: adminData.user.id, role: "admin" });

        if (roleError) {
          console.error("Admin role insert error:", roleError);
          results.errors.push(`Admin role: ${roleError.message}`);
        }
      } else if (existingAdminRole.role !== "admin") {
        const { error: updateError } = await supabaseAdmin
          .from("user_roles")
          .update({ role: "admin" })
          .eq("user_id", adminData.user.id);

        if (updateError) {
          console.error("Admin role update error:", updateError);
          results.errors.push(`Admin role update: ${updateError.message}`);
        }
      }

      results.admin = {
        id: adminData.user.id,
        email: adminData.user.email,
        role: "admin",
      };
    }

    // Create client users
    if (clients && Array.isArray(clients)) {
      for (const client of clients) {
        if (!client.email || !client.password) {
          results.errors.push(`Client missing email or password`);
          continue;
        }

        if (!emailRegex.test(client.email)) {
          results.errors.push(`Invalid email format: ${client.email}`);
          continue;
        }

        if (client.password.length < 6) {
          results.errors.push(`Password too short for: ${client.email}`);
          continue;
        }

        console.log("Creating client user:", client.email);
        const { data: clientData, error: clientError } = await supabaseAdmin.auth.admin.createUser({
          email: client.email,
          password: client.password,
          email_confirm: true,
          user_metadata: { role: "client" },
        });

        if (clientError) {
          console.error("Client creation error:", clientError);
          results.errors.push(`Client ${client.email}: ${clientError.message}`);
        } else if (clientData.user) {
          console.log("Client user created:", clientData.user.id);
          
          const { data: existingClientRole } = await supabaseAdmin
            .from("user_roles")
            .select("role")
            .eq("user_id", clientData.user.id)
            .single();

          if (!existingClientRole) {
            const { error: roleError } = await supabaseAdmin
              .from("user_roles")
              .insert({ user_id: clientData.user.id, role: "client" });

            if (roleError) {
              console.error("Client role insert error:", roleError);
              results.errors.push(`Client role for ${client.email}: ${roleError.message}`);
            }
          }

          results.clients.push({
            id: clientData.user.id,
            email: clientData.user.email,
            role: "client",
          });
        }
      }
    }

    // Determine response status
    const hasErrors = results.errors.length > 0;
    const hasSuccess = results.admin || results.clients.length > 0;

    if (!hasSuccess) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Failed to create any users",
          errors: results.errors 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: hasErrors ? "Users created with some errors" : "Users created successfully",
        data: {
          admin: results.admin || null,
          clients: results.clients,
        },
        errors: hasErrors ? results.errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Seed users error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
