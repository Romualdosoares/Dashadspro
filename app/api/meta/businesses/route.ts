import { NextResponse } from "next/server";
import { requireOrganizationFeature } from "../../../../lib/feature-access";
import { getFacebookToken } from "@/lib/meta-token";
import {
  fetchUserBusinesses,
  fetchUserAdAccounts,
  fetchBusinessAdAccounts,
} from "@/lib/meta-api";

export async function GET(request: Request) {
  const requestedOrganizationId = new URL(request.url).searchParams.get("organization_id");
  const access = await requireOrganizationFeature("dashboard_ads", requestedOrganizationId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { user } = access;

  const { token: accessToken } = await getFacebookToken(user);

  if (!accessToken) {
    return NextResponse.json(
      { error: "Token do Facebook não disponível. Faça login novamente com o Facebook." },
      { status: 403 }
    );
  }

  try {
    const [businesses, personalAccounts] = await Promise.all([
      fetchUserBusinesses(accessToken),
      fetchUserAdAccounts(accessToken),
    ]);

    const businessAccountResults = await Promise.all(
      businesses.map((b) => fetchBusinessAdAccounts(b.id, accessToken))
    );

    const businessAccounts = businesses.map((business, i) => ({
      business,
      accounts: businessAccountResults[i],
    }));

    return NextResponse.json({ personalAccounts, businessAccounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida";
    return NextResponse.json(
      { error: `Meta não conseguiu listar contas: ${message}` },
      { status: 502 },
    );
  }
}
