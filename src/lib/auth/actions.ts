"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  signUpSchema,
  signInSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema,
  type SignUpInput,
  type SignInInput,
  type ForgotPasswordInput,
  type ResetPasswordInput,
  type ChangePasswordInput,
  type UpdateProfileInput,
} from "@/lib/validations/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/permissions";
import { enforceRateLimit, getRequestIp } from "@/lib/auth/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import { getClientEnv } from "@/lib/env";
import { actionOk, actionError, type ActionResult } from "@/lib/action-result";
import type { ThemePreference } from "@/types/database";

export async function signUpAction(input: SignUpInput): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }
  const { fullName, username, email, phone, password } = parsed.data;

  const ip = await getRequestIp();
  const allowed = await enforceRateLimit("signup", ip, 10, 3600);
  if (!allowed) {
    return actionError("Too many sign-up attempts. Please try again later.");
  }

  // Pre-check username/email/phone availability with friendly, specific,
  // per-field errors — the DB's unique indexes (profiles_username_lower_idx/
  // profiles_email_lower_idx/profiles_phone_idx) are still the real
  // guarantee against a race between this check and the actual insert;
  // this is just so a duplicate surfaces as a normal validation error
  // instead of a raw constraint-violation failure.
  const admin = createAdminSupabaseClient();
  const [{ data: existingUsername }, { data: existingEmail }, { data: existingPhone }] = await Promise.all([
    admin.from("profiles").select("id").ilike("username", username).maybeSingle(),
    admin.from("profiles").select("id").ilike("email", email).maybeSingle(),
    admin.from("profiles").select("id").eq("phone", phone).maybeSingle(),
  ]);

  const fieldErrors: Record<string, string[]> = {};
  if (existingUsername) fieldErrors.username = ["This username is already taken."];
  if (existingEmail) fieldErrors.email = ["An account with this email already exists."];
  if (existingPhone) fieldErrors.phone = ["An account with this phone number already exists."];
  if (Object.keys(fieldErrors).length > 0) {
    return actionError("Please fix the errors below.", fieldErrors);
  }

  const env = getClientEnv();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, full_name: fullName, phone },
      emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  });

  if (error) {
    // Always log the real cause — the generic message below tells the
    // customer nothing, and Supabase Auth failures are otherwise invisible
    // (check Vercel → Logs, or Supabase → Logs → Auth).
    console.error("[signUpAction] supabase.auth.signUp failed:", {
      code: error.code,
      status: error.status,
      message: error.message,
    });

    const message = error.message.toLowerCase();
    // Belt-and-suspenders: a race between the pre-check above and this
    // call (or Supabase Auth's own duplicate-email detection) can still
    // surface here.
    if (error.code === "user_already_exists" || error.code === "email_exists" || message.includes("registered")) {
      return actionError("Please fix the errors below.", {
        email: ["An account with this email already exists."],
      });
    }
    if (error.code === "weak_password") {
      return actionError("Please fix the errors below.", {
        password: [error.message],
      });
    }
    if (error.code === "email_address_invalid") {
      return actionError("Please fix the errors below.", {
        email: ["This email address can't be used. Please use a different one."],
      });
    }
    // Verification email couldn't be sent: Supabase's built-in mailer only
    // delivers to the project's team members and a few emails/hour, so a
    // live store needs custom SMTP (README 7.3b); a misconfigured custom
    // SMTP fails the same way.
    if (
      error.code === "email_address_not_authorized" ||
      error.code === "over_email_send_rate_limit" ||
      message.includes("sending confirmation email") ||
      message.includes("rate limit")
    ) {
      return actionError("We couldn't send your verification email right now. Please try again later.");
    }
    return actionError("Could not create your account. Please try again.");
  }

  return actionOk(undefined);
}

export async function signInAction(
  input: SignInInput,
): Promise<ActionResult<{ defaultRedirect: string }>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Enter your username/email and password.");
  }
  const { identifier, password } = parsed.data;

  const ip = await getRequestIp();
  const allowed = await enforceRateLimit(
    "login",
    `${ip}:${identifier.toLowerCase()}`,
    5,
    300,
  );
  if (!allowed) {
    return actionError("Too many attempts. Please try again in a few minutes.");
  }

  const admin = createAdminSupabaseClient();
  const { data: resolvedEmail } = await admin.rpc("lookup_email_for_login", {
    p_identifier: identifier,
  });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    // Falls back to a never-valid email when the identifier doesn't
    // resolve, so a nonexistent-user attempt takes the same code path
    // (and error) as a wrong-password attempt.
    email: resolvedEmail ?? `${identifier}@invalid.local`,
    password,
  });

  if (error) {
    return actionError("Incorrect username/email or password.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let defaultRedirect = "/account";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("blocked_at, deleted_at, role")
      .eq("id", user.id)
      .single();

    if (profile?.blocked_at || profile?.deleted_at) {
      await supabase.auth.signOut();
      return actionError(
        "This account has been suspended. Contact support if you think this is a mistake.",
      );
    }

    if (profile?.role === "admin") {
      defaultRedirect = "/admin";
    }
  }

  return actionOk({ defaultRedirect });
}

export async function signOutAction(): Promise<never> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

export async function forgotPasswordAction(
  input: ForgotPasswordInput,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  // Even invalid input gets the generic response — no signal either way.
  const genericResult = actionOk(undefined);
  if (!parsed.success) return genericResult;

  const ip = await getRequestIp();
  const allowed = await enforceRateLimit(
    "forgot_password",
    `${ip}:${parsed.data.email.toLowerCase()}`,
    3,
    600,
  );

  if (allowed) {
    const env = getClientEnv();
    const supabase = await createServerSupabaseClient();
    // Points at the Route Handler (not /reset-password directly) because
    // exchanging the recovery code for a session needs to set cookies,
    // which a Server Component page is not allowed to do.
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?type=recovery`,
    });
  }

  // Rule: never reveal whether an account exists for this email, and never
  // reveal that the caller was rate-limited either — same response always.
  return genericResult;
}

export async function resetPasswordAction(
  input: ResetPasswordInput,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return actionError(
      "Your password reset link has expired. Please request a new one.",
    );
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return actionError("Could not update your password. Please try again.");
  }

  // Service-role: clearing must_change_password is one of the
  // privileged columns protect_profile_privileged_columns guards.
  await createAdminSupabaseClient()
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", user.id);

  await writeAuditLog({
    actorId: user.id,
    action: "auth.password_reset",
    entityType: "profiles",
    entityId: user.id,
  });

  return actionOk(undefined);
}

export async function changePasswordAction(
  input: ChangePasswordInput,
): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const profile = await requireUser();
  const supabase = await createServerSupabaseClient();

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: parsed.data.currentPassword,
  });
  if (verifyError) {
    return actionError("Please fix the errors below.", {
      currentPassword: ["Current password is incorrect."],
    });
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });
  if (error) {
    return actionError("Could not update your password. Please try again.");
  }

  if (profile.must_change_password) {
    await createAdminSupabaseClient()
      .from("profiles")
      .update({ must_change_password: false })
      .eq("id", profile.id);
  }

  await writeAuditLog({
    actorId: profile.id,
    action: "auth.password_changed",
    entityType: "profiles",
    entityId: profile.id,
  });

  return actionOk(undefined);
}

export async function updateProfileAction(
  input: UpdateProfileInput,
): Promise<ActionResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return actionError("Please fix the errors below.", parsed.error.flatten().fieldErrors);
  }

  const profile = await requireUser();
  const admin = createAdminSupabaseClient();

  const [{ data: existingUsername }, { data: existingPhone }] = await Promise.all([
    admin.from("profiles").select("id").ilike("username", parsed.data.username).neq("id", profile.id).maybeSingle(),
    admin.from("profiles").select("id").eq("phone", parsed.data.phone).neq("id", profile.id).maybeSingle(),
  ]);

  const fieldErrors: Record<string, string[]> = {};
  if (existingUsername) fieldErrors.username = ["This username is already taken."];
  if (existingPhone) fieldErrors.phone = ["An account with this phone number already exists."];
  if (Object.keys(fieldErrors).length > 0) {
    return actionError("Please fix the errors below.", fieldErrors);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      username: parsed.data.username,
      phone: parsed.data.phone,
    })
    .eq("id", profile.id);

  if (error) {
    return actionError("Could not update your profile. Please try again.");
  }

  revalidatePath("/account");
  return actionOk(undefined);
}

export async function updateThemePreferenceAction(
  theme: ThemePreference,
): Promise<ActionResult> {
  const profile = await requireUser();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("profiles")
    .update({ theme_preference: theme })
    .eq("id", profile.id);

  if (error) return actionError("Could not save your theme preference.");
  return actionOk(undefined);
}

export async function deleteAccountAction(input: {
  password: string;
}): Promise<ActionResult> {
  const profile = await requireUser();
  const supabase = await createServerSupabaseClient();

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: profile.email,
    password: input.password,
  });
  if (verifyError) {
    return actionError("Please fix the errors below.", {
      password: ["Incorrect password."],
    });
  }

  const admin = createAdminSupabaseClient();

  const { error: anonymizeError } = await admin.rpc("anonymize_profile", {
    p_profile_id: profile.id,
  });
  if (anonymizeError) {
    console.error("[deleteAccount] anonymize_profile failed:", anonymizeError);
    return actionError(
      "Could not delete your account. Please try again or contact support.",
    );
  }

  // Ban (never hard-delete) the Auth user so profiles.id — and every
  // historical order/review/payment FK pointing at it — stays valid.
  const { error: banError } = await admin.auth.admin.updateUserById(profile.id, {
    ban_duration: "87600h", // ~10 years: effectively permanent, not "forever" (a value Go's duration parser rejects)
  });
  if (banError) {
    console.error("[deleteAccount] failed to ban auth user:", banError);
  }

  await writeAuditLog({
    actorId: profile.id,
    action: "customer.self_delete_account",
    entityType: "profiles",
    entityId: profile.id,
  });

  await supabase.auth.signOut();
  redirect("/");
}
