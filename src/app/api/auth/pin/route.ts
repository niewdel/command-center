import { NextRequest, NextResponse } from "next/server";

const APP_PIN = process.env.APP_PIN || "2114";

export async function POST(request: NextRequest) {
  const { pin } = await request.json();

  if (pin !== APP_PIN) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("cc-auth", "authenticated", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return response;
}
