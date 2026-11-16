import test from "node:test";
import assert from "node:assert/strict";
import { createMockPrisma, resetMockStore } from "./mock-db";

test("mock-db seeds demo users, movies, and classic horror watch party room", async () => {
  const store = resetMockStore();
  const db = createMockPrisma(() => store);

  const featured = await db.movie.findMany({ where: { source: "ARCHIVE" } });
  assert.equal(featured.length, 4);
  assert.equal(featured[0].title, "Night of the Living Dead");

  const rooms = await db.room.findMany({
    where: { isPublic: true },
    include: {
      host: { select: { id: true, username: true } },
      movie: { select: { id: true, title: true } },
      _count: { select: { members: true } },
    },
  });
  assert.equal(rooms.length, 1);
  assert.equal(rooms[0].name, "Classic Horror Night");
  assert.equal(rooms[0].host.username, "cinephile");
  assert.equal(rooms[0]._count.members, 1);
});

test("mock-db supports case-insensitive OR queries, compound uniques, and updates", async () => {
  const store = resetMockStore();
  const db = createMockPrisma(() => store);

  const admin = await db.user.findFirst({
    where: {
      OR: [
        { username: { equals: "ADMIN", mode: "insensitive" } },
        { email: { equals: "admin@cinema.dev", mode: "insensitive" } },
      ],
    },
  });
  assert.ok(admin);
  assert.equal(admin.role, "ADMIN");

  const created = await db.user.create({
    data: {
      username: "moviefan",
      email: "moviefan@example.com",
      password: "hashed_password",
    },
  });
  assert.ok(created.id);

  const review = await db.review.create({
    data: {
      userId: created.id,
      movieId: "movie_notld_1968",
      rating: 8,
      content: "Atmospheric masterpiece",
    },
  });
  assert.equal(review.rating, 8);

  const foundByCompound = await db.review.findUnique({
    where: { userId_movieId: { userId: created.id, movieId: "movie_notld_1968" } },
  });
  assert.ok(foundByCompound);
  assert.equal(foundByCompound.content, "Atmospheric masterpiece");

  const count = await db.review.count({ where: { movieId: "movie_notld_1968" } });
  assert.equal(count, 2);
});
