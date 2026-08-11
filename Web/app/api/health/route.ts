import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "catalogguard-web",
    status: "ok",
  });
}
