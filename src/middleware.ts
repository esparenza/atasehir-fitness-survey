import { NextRequest, NextResponse } from "next/server";

/**
 * DASHBOARD_PASSWORD tanımlıysa panel ve yönetim API'leri Basic Auth ister.
 * Meta'nın çağırdığı webhook hariçtir.
 */
export function middleware(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const [, pass] = atob(header.slice(6)).split(/:(.*)/s);
    if (pass === password) return NextResponse.next();
  }
  return new NextResponse("Yetkisiz", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Atasehir Fitness"' },
  });
}

export const config = {
  matcher: ["/((?!api/whatsapp/webhook|privacy|_next/static|_next/image|favicon.ico).*)"],
};
