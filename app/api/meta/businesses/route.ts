import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFacebookToken } from "@/lib/meta-token";
import {
  fetchUserBusinesses,
  fetchUserAdAccounts,
  fetchBusinessAdAccounts,
} from "@/lib/meta-api";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token: accessToken } = await getFacebookToken();

  if (!accessToken) {
    return NextResponse.json(
      { error: "Token do Facebook não disponível. Faça login novamente com o Facebook." },
      { status: 403 }
    );
  }

  const [businesses, personalAccounts] = await Promise.all([
    fetchUserBusinesses(accessToken),
    fetchUserAdAccounts(accessToken),
  ]);

  const businessAccountResults = await Promise.all(
    businesses.map((b) => fetchBusinessAdAccounts(b.id, accessToken!))
  );

  const businessAccounts = businesses.map((business, i) => ({
    business,
    accounts: businessAccountResults[i],
  }));

  return NextResponse.json({ personalAccounts, businessAccounts });
}
