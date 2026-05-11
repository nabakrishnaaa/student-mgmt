// import { NextRequest, NextResponse } from "next/server";
// import bcrypt from "bcryptjs";
// import { getDb } from "@/lib/db";
// import { signToken, buildCookieHeader, JWTPayload } from "@/lib/auth";

// export async function POST(req: NextRequest) {
//   const { username, password } = await req.json();

//   if (!username || !password) {
//     return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
//   }

//   const db = await getDb();

//   // Raw SQL: fetch user by username
//   const user = await db.get<{
//     id: number; username: string; password_hash: string;
//     role: "student" | "admin"; student_id: number | null;
//   }>(
//     "SELECT id, username, password_hash, role, student_id FROM users WHERE username = ?",
//     [username]
//   );

//   if (!user) {
//     return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
//   }

//   // Compare submitted password against stored bcrypt hash
//   const valid = await bcrypt.compare(password, user.password_hash);
//   if (!valid) {
//     return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
//   }

//   const payload: JWTPayload = {
//     userId: user.id,
//     username: user.username,
//     role: user.role,
//     studentId: user.student_id,
//   };

//   const token = signToken(payload);

//   const res = NextResponse.json({ role: user.role });
//   res.headers.set("Set-Cookie", buildCookieHeader(token));
//   return res;
// }


//new code---------------------------------------------------------------------------------------
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDb } from "@/lib/db";
import { signToken, buildCookieHeader, JWTPayload } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    // ── Rate limiting ────────────────────────────────────────────────────
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    const { allowed, remaining, retryAfterMs } = checkRateLimit(
      `login:${ip}`,
      10,
      15 * 60 * 1000
    );

    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      return NextResponse.json(
        {
          error: `Too many login attempts. Please try again in ${Math.ceil(
            retryAfterSec / 60
          )} minute(s).`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // ── Validate input ───────────────────────────────────────────────────
    let body: { username?: string; password?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }

    // ── Check JWT_SECRET is configured ──────────────────────────────────
    if (!process.env.JWT_SECRET) {
      console.error("FATAL: JWT_SECRET environment variable is not set.");
      return NextResponse.json(
        { error: "Server misconfiguration. Please contact the administrator." },
        { status: 500 }
      );
    }

    // ── DB lookup ────────────────────────────────────────────────────────
    const db = await getDb();

    const user = await db.get<{
      id: number;
      username: string;
      password_hash: string;
      role: "student" | "admin";
      student_id: number | null;
    }>(
      "SELECT id, username, password_hash, role, student_id FROM users WHERE username = ?",
      [username]
    );

    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    // ── Password check ───────────────────────────────────────────────────
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return NextResponse.json(
        { error: "Invalid credentials." },
        { status: 401 }
      );
    }

    // ── Sign token & respond ─────────────────────────────────────────────
    const payload: JWTPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      studentId: user.student_id,
    };

    const token = signToken(payload);

    const res = NextResponse.json(
      { role: user.role },
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
    res.headers.set("Set-Cookie", buildCookieHeader(token));
    return res;

  } catch (err) {
    // ── Catch-all: always return valid JSON so the client never gets
    //    "Unexpected end of JSON input"
    console.error("Login route error:", err);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}