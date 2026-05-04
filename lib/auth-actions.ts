"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function signInAction(email: string, password: string) {
  const supabase = await createServerSupabaseClient();

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    if (data.user) {
      revalidatePath("/");
      return { success: true, user: data.user };
    }
  } catch (error) {
    console.error("Sign in error:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();

  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/");
    redirect("/signin");
  } catch (error) {
    console.error("Sign out error:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function getSessionAction() {
  const supabase = await createServerSupabaseClient();

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return { error: error.message };
    }

    return { session };
  } catch (error) {
    console.error("Get session error:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function getUserAction() {
  const supabase = await createServerSupabaseClient();

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return { error: error.message };
    }

    return { user };
  } catch (error) {
    console.error("Get user error:", error);
    return { error: "An unexpected error occurred" };
  }
}
