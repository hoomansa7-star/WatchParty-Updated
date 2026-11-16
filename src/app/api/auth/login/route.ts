import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword,
  signAccessToken,
  issueRefreshToken,
  setRefreshCookie,
} from "@/lib/auth";
import { ok, fail } from "@/lib/response";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit(ip, 60, 60_000);
  if (!rl.ok) return fail("تعداد درخواست‌ها بیش از حد مجاز است. لطفاً بعداً دوباره امتحان کنید.", 429);

  const body = await req.json().catch(() => null);
  if (!body) return fail("اطلاعات ارسال نشده است", 400);

  const rawIdentifier = (
    body.username ||
    body.name ||
    body.email ||
    body.identifier ||
    ""
  ).toString().trim();

  const rawPassword = (body.password || "").toString().trim();

  if (!rawIdentifier) {
    return fail("لطفاً نام یا نام کاربری خود را وارد کنید", 400);
  }

  const isLower = rawIdentifier.toLowerCase();
  const isAdminLogin = isLower === "admin" || isLower === "admin@cinema.dev";

  // Case 1: Admin Login
  if (isAdminLogin) {
    if (rawPassword && rawPassword !== "12345") {
      return fail("رمز عبور ادمین نادرست است (رمز صحیح: 12345)", 401);
    }

    let admin = await db.user.findFirst({
      where: {
        OR: [
          { username: { equals: "admin", mode: "insensitive" } },
          { email: { equals: "admin@cinema.dev", mode: "insensitive" } },
        ],
      },
    });

    const adminHash = await hashPassword("12345");
    if (!admin) {
      admin = await db.user.create({
        data: {
          username: "admin",
          email: "admin@cinema.dev",
          password: adminHash,
          role: "ADMIN",
        },
      });
    } else {
      admin = await db.user.update({
        where: { id: admin.id },
        data: {
          role: "ADMIN",
          password: adminHash,
          banned: false,
        },
      });
    }

    const accessToken = signAccessToken({
      userId: admin.id,
      role: admin.role,
      tokenVersion: admin.tokenVersion,
    });
    const refresh = await issueRefreshToken(admin.id);
    await setRefreshCookie(refresh);

    return ok({
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        avatar: admin.avatar,
        bio: admin.bio,
        language: admin.language,
        theme: admin.theme,
      },
      accessToken,
    });
  }

  // Case 2: Regular user login (by name/username)
  let user = await db.user.findFirst({
    where: {
      OR: [
        { username: { equals: rawIdentifier, mode: "insensitive" } },
        { email: { equals: rawIdentifier, mode: "insensitive" } },
      ],
    },
  });

  if (user && user.banned) {
    return fail("این حساب کاربری مسدود شده است", 403);
  }

  if (!user) {
    const cleanUsername = rawIdentifier.slice(0, 30);
    const emailCandidate = rawIdentifier.includes("@")
      ? rawIdentifier.toLowerCase()
      : `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}@cinema.local`;

    const defaultHash = await hashPassword("123456");

    try {
      user = await db.user.create({
        data: {
          username: cleanUsername,
          email: emailCandidate,
          password: defaultHash,
          role: "USER",
        },
      });
    } catch {
      user = await db.user.create({
        data: {
          username: `${cleanUsername.slice(0, 20)}_${Math.random().toString(36).slice(2, 6)}`,
          email: `user_${Date.now().toString(36)}@cinema.local`,
          password: defaultHash,
          role: "USER",
        },
      });
    }
  }

  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
  const refresh = await issueRefreshToken(user.id);
  await setRefreshCookie(refresh);

  return ok({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      bio: user.bio,
      language: user.language,
      theme: user.theme,
    },
    accessToken,
  });
}
