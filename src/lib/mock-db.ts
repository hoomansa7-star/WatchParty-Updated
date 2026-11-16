import bcrypt from "bcryptjs";

type AnyRecord = Record<string, any>;

interface MockStore {
  user: AnyRecord[];
  refreshToken: AnyRecord[];
  movie: AnyRecord[];
  room: AnyRecord[];
  roomMember: AnyRecord[];
  message: AnyRecord[];
  review: AnyRecord[];
  follow: AnyRecord[];
  watchlist: AnyRecord[];
  watchlistItem: AnyRecord[];
  notification: AnyRecord[];
}

function cuid(prefix = "id"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function createInitialStore(): MockStore {
  const now = new Date();
  const earlier = new Date(now.getTime() - 3600_000);

  const adminId = "user_admin_1";
  const demoId = "user_demo_1";
  const adminHash = bcrypt.hashSync("12345", 10);
  const demoHash = bcrypt.hashSync("demo123", 10);

  const movies: AnyRecord[] = [
    {
      id: "movie_notld_1968",
      tmdbId: null,
      title: "Night of the Living Dead",
      titleFa: "شب مردگان زنده",
      poster: "https://archive.org/services/img/night-of-the-living-dead-1968-by-george-a.-romero",
      backdrop: "https://archive.org/services/img/night-of-the-living-dead-1968-by-george-a.-romero",
      description:
        "A group of people hide from bloodthirsty zombies in a farmhouse. George A. Romero's genre-defining horror classic — public domain.",
      year: 1968,
      rating: 7.9,
      genre: "Horror / Classic",
      runtime: 96,
      source: "ARCHIVE",
      videoUrl: "https://archive.org/embed/night-of-the-living-dead-1968-by-george-a.-romero",
      trailerUrl: null,
      archiveId: "night-of-the-living-dead-1968-by-george-a.-romero",
      youtubeId: null,
      vimeoId: null,
      createdAt: new Date(earlier.getTime() - 40_000),
      updatedAt: earlier,
    },
    {
      id: "movie_nosferatu_1922",
      tmdbId: null,
      title: "Nosferatu",
      titleFa: "نوسفراتو",
      poster: "https://archive.org/services/img/nosferatu-1922-colorized",
      backdrop: "https://archive.org/services/img/nosferatu-1922-colorized",
      description:
        "A real-estate agent travels to the Carpathian Mountains to meet the eerie Count Orlok. F.W. Murnau's silent vampire masterpiece.",
      year: 1922,
      rating: 7.8,
      genre: "Silent / Horror",
      runtime: 94,
      source: "ARCHIVE",
      videoUrl: "https://archive.org/embed/nosferatu-1922-colorized",
      trailerUrl: null,
      archiveId: "nosferatu-1922-colorized",
      youtubeId: null,
      vimeoId: null,
      createdAt: new Date(earlier.getTime() - 30_000),
      updatedAt: earlier,
    },
    {
      id: "movie_general_1926",
      tmdbId: null,
      title: "The General",
      titleFa: "ژنرال",
      poster: "https://archive.org/services/img/TheGeneral1926",
      backdrop: "https://archive.org/services/img/TheGeneral1926",
      description:
        "A Southern railroad engineer pursues his stolen locomotive and the woman he loves during the American Civil War. Buster Keaton's comedic gem.",
      year: 1926,
      rating: 8.1,
      genre: "Silent / Comedy",
      runtime: 78,
      source: "ARCHIVE",
      videoUrl: "https://archive.org/embed/TheGeneral1926",
      trailerUrl: null,
      archiveId: "TheGeneral1926",
      youtubeId: null,
      vimeoId: null,
      createdAt: new Date(earlier.getTime() - 20_000),
      updatedAt: earlier,
    },
    {
      id: "movie_moon_1902",
      tmdbId: null,
      title: "A Trip to the Moon",
      titleFa: "سفر به ماه",
      poster: "https://archive.org/services/img/le-voyage-dans-la-lune-1902-georges-melies",
      backdrop: "https://archive.org/services/img/le-voyage-dans-la-lune-1902-georges-melies",
      description:
        "Astronomers travel to the Moon in a bullet-shaped capsule. Georges Méliès's pioneering science-fiction adventure.",
      year: 1902,
      rating: 8.2,
      genre: "Silent / Sci-Fi",
      runtime: 14,
      source: "ARCHIVE",
      videoUrl: "https://archive.org/embed/le-voyage-dans-la-lune-1902-georges-melies",
      trailerUrl: null,
      archiveId: "le-voyage-dans-la-lune-1902-georges-melies",
      youtubeId: null,
      vimeoId: null,
      createdAt: new Date(earlier.getTime() - 10_000),
      updatedAt: earlier,
    },
  ];

  const roomId = "room_classic_horror";

  return {
    user: [
      {
        id: adminId,
        username: "admin",
        email: "admin@cinema.dev",
        password: adminHash,
        avatar: null,
        bio: "Cinema Social administrator",
        role: "ADMIN",
        language: "en",
        theme: "dark",
        banned: false,
        tokenVersion: 0,
        watchHours: 12,
        createdAt: earlier,
        updatedAt: earlier,
      },
      {
        id: demoId,
        username: "cinephile",
        email: "cinephile@cinema.dev",
        password: demoHash,
        avatar: null,
        bio: "Lover of classic and cult cinema.",
        role: "USER",
        language: "en",
        theme: "dark",
        banned: false,
        tokenVersion: 0,
        watchHours: 8,
        createdAt: earlier,
        updatedAt: earlier,
      },
    ],
    refreshToken: [],
    movie: movies,
    room: [
      {
        id: roomId,
        name: "Classic Horror Night",
        description: "Watch George A. Romero's 1968 classic together with live chat.",
        movieId: "movie_notld_1968",
        hostId: demoId,
        isPublic: true,
        maxUsers: 50,
        status: "WAITING",
        currentTime: 0,
        isPlaying: false,
        lastSyncAt: now,
        createdAt: earlier,
        updatedAt: earlier,
      },
    ],
    roomMember: [
      {
        id: "rm_demo_1",
        userId: demoId,
        roomId,
        role: "HOST",
        joinedAt: earlier,
      },
    ],
    message: [],
    review: [
      {
        id: "rev_demo_1",
        content:
          "Still terrifying after all these decades. The grainy black-and-white photography and claustrophobic farmhouse setting make this a masterclass in dread.",
        rating: 9,
        userId: demoId,
        movieId: "movie_notld_1968",
        createdAt: earlier,
        updatedAt: earlier,
      },
    ],
    follow: [],
    watchlist: [
      {
        id: "wl_demo_1",
        name: "Classic Horror",
        userId: demoId,
        isPublic: true,
        createdAt: earlier,
        updatedAt: earlier,
      },
    ],
    watchlistItem: [
      {
        id: "wli_demo_1",
        watchlistId: "wl_demo_1",
        movieId: "movie_notld_1968",
        addedAt: earlier,
      },
    ],
    notification: [],
  };
}

const globalForMock = globalThis as unknown as {
  __watchpartyMockStore?: MockStore;
};

export function getMockStore(): MockStore {
  if (!globalForMock.__watchpartyMockStore) {
    globalForMock.__watchpartyMockStore = createInitialStore();
  }
  return globalForMock.__watchpartyMockStore;
}

export function resetMockStore(): MockStore {
  globalForMock.__watchpartyMockStore = createInitialStore();
  return globalForMock.__watchpartyMockStore;
}

function matchCondition(value: any, cond: any): boolean {
  if (cond === undefined) return true;
  if (cond === null || typeof cond !== "object" || cond instanceof Date) {
    return value === cond;
  }
  if ("equals" in cond) {
    if (cond.mode === "insensitive" && typeof value === "string" && typeof cond.equals === "string") {
      return value.toLowerCase() === cond.equals.toLowerCase();
    }
    return value === cond.equals;
  }
  if ("contains" in cond) {
    if (typeof value !== "string" || typeof cond.contains !== "string") return false;
    return value.toLowerCase().includes(cond.contains.toLowerCase());
  }
  if ("in" in cond && Array.isArray(cond.in)) {
    return cond.in.includes(value);
  }
  if ("notIn" in cond && Array.isArray(cond.notIn)) {
    return !cond.notIn.includes(value);
  }
  if ("gt" in cond) {
    return value != null && value > cond.gt;
  }
  if ("gte" in cond) {
    return value != null && value >= cond.gte;
  }
  if ("lt" in cond) {
    return value != null && value < cond.lt;
  }
  if ("lte" in cond) {
    return value != null && value <= cond.lte;
  }
  if ("not" in cond) {
    return !matchCondition(value, cond.not);
  }
  return value === cond;
}

function matchWhere(store: MockStore, model: keyof MockStore, record: AnyRecord, where?: AnyRecord): boolean {
  if (!where) return true;

  for (const [key, cond] of Object.entries(where)) {
    if (cond === undefined) continue;

    if (key === "OR" && Array.isArray(cond)) {
      if (!cond.some((sub) => matchWhere(store, model, record, sub))) return false;
      continue;
    }
    if (key === "AND" && Array.isArray(cond)) {
      if (!cond.every((sub) => matchWhere(store, model, record, sub))) return false;
      continue;
    }
    if (key === "NOT") {
      if (Array.isArray(cond)) {
        if (cond.some((sub) => matchWhere(store, model, record, sub))) return false;
      } else if (matchWhere(store, model, record, cond)) {
        return false;
      }
      continue;
    }

    // Compound unique keys
    if (key === "userId_movieId" && cond && typeof cond === "object") {
      if (record.userId !== cond.userId || record.movieId !== cond.movieId) return false;
      continue;
    }
    if (key === "userId_roomId" && cond && typeof cond === "object") {
      if (record.userId !== cond.userId || record.roomId !== cond.roomId) return false;
      continue;
    }
    if (key === "followerId_followingId" && cond && typeof cond === "object") {
      if (record.followerId !== cond.followerId || record.followingId !== cond.followingId) return false;
      continue;
    }
    if (key === "watchlistId_movieId" && cond && typeof cond === "object") {
      if (record.watchlistId !== cond.watchlistId || record.movieId !== cond.movieId) return false;
      continue;
    }

    // Nested relation filter: e.g. watchlistItem.where.watchlist = { userId }
    if (model === "watchlistItem" && key === "watchlist" && cond && typeof cond === "object") {
      const wl = store.watchlist.find((w) => w.id === record.watchlistId);
      if (!wl || !matchWhere(store, "watchlist", wl, cond)) return false;
      continue;
    }

    if (!matchCondition(record[key], cond)) return false;
  }

  return true;
}

function hydrateRecord(
  store: MockStore,
  model: keyof MockStore,
  record: AnyRecord,
  options?: { include?: AnyRecord; select?: AnyRecord }
): AnyRecord {
  const base: AnyRecord = { ...record };

  const attachRelations = (target: AnyRecord, spec: AnyRecord, isSelect: boolean) => {
    for (const [rel, relSpec] of Object.entries(spec)) {
      if (!relSpec) continue;

      if (rel === "_count" && typeof relSpec === "object" && relSpec.select) {
        const counts: AnyRecord = {};
        for (const countField of Object.keys(relSpec.select)) {
          counts[countField] = computeCount(store, model, record, countField);
        }
        target._count = counts;
        continue;
      }

      const relOpts = typeof relSpec === "object" ? relSpec : undefined;
      const related = resolveRelation(store, model, record, rel, relOpts);
      if (related !== undefined) {
        target[rel] = related;
      } else if (isSelect) {
        target[rel] = record[rel];
      }
    }
  };

  if (options?.select) {
    const out: AnyRecord = {};
    for (const [field, val] of Object.entries(options.select)) {
      if (!val) continue;
      if (field === "_count" || isRelationField(model, field)) {
        attachRelations(out, { [field]: val }, true);
      } else {
        out[field] = base[field];
      }
    }
    return out;
  }

  if (options?.include) {
    attachRelations(base, options.include, false);
  }

  return base;
}

function isRelationField(model: keyof MockStore, field: string): boolean {
  const relationMap: Record<string, string[]> = {
    user: ["reviews", "watchlists", "followers", "following", "messages", "receivedMsgs", "roomMembers", "notifications", "notifActor", "hostedRooms", "refreshTokens"],
    refreshToken: ["user"],
    movie: ["reviews", "watchlistItems", "rooms"],
    room: ["movie", "host", "members", "messages"],
    roomMember: ["user", "room"],
    message: ["user", "receiver", "room"],
    review: ["user", "movie"],
    follow: ["follower", "following"],
    watchlist: ["user", "items"],
    watchlistItem: ["watchlist", "movie"],
    notification: ["user", "actor"],
  };
  return relationMap[model]?.includes(field) ?? false;
}

function computeCount(store: MockStore, model: keyof MockStore, record: AnyRecord, field: string): number {
  if (model === "user") {
    if (field === "reviews") return store.review.filter((r) => r.userId === record.id).length;
    if (field === "followers") return store.follow.filter((f) => f.followingId === record.id).length;
    if (field === "following") return store.follow.filter((f) => f.followerId === record.id).length;
    if (field === "watchlists") return store.watchlist.filter((w) => w.userId === record.id).length;
  }
  if (model === "room") {
    if (field === "members") return store.roomMember.filter((m) => m.roomId === record.id).length;
    if (field === "messages") return store.message.filter((m) => m.roomId === record.id).length;
  }
  if (model === "watchlist") {
    if (field === "items") return store.watchlistItem.filter((i) => i.watchlistId === record.id).length;
  }
  if (model === "movie") {
    if (field === "reviews") return store.review.filter((r) => r.movieId === record.id).length;
  }
  return 0;
}

function resolveRelation(
  store: MockStore,
  model: keyof MockStore,
  record: AnyRecord,
  rel: string,
  opts?: AnyRecord
): any {
  const single = (targetModel: keyof MockStore, fkValue: string | null | undefined) => {
    if (!fkValue) return null;
    const found = store[targetModel].find((r) => r.id === fkValue);
    return found ? hydrateRecord(store, targetModel, found, opts) : null;
  };
  const many = (targetModel: keyof MockStore, fkField: string, filterId: string) => {
    let items = store[targetModel].filter((r) => r[fkField] === filterId);
    if (opts?.orderBy) items = sortRecords(items, opts.orderBy);
    if (opts?.take) items = items.slice(0, opts.take);
    return items.map((r) => hydrateRecord(store, targetModel, r, opts));
  };

  if (model === "refreshToken" && rel === "user") return single("user", record.userId);
  if (model === "room") {
    if (rel === "host") return single("user", record.hostId);
    if (rel === "movie") return single("movie", record.movieId);
    if (rel === "members") return many("roomMember", "roomId", record.id);
    if (rel === "messages") return many("message", "roomId", record.id);
  }
  if (model === "roomMember") {
    if (rel === "user") return single("user", record.userId);
    if (rel === "room") return single("room", record.roomId);
  }
  if (model === "message") {
    if (rel === "user") return single("user", record.userId);
    if (rel === "receiver") return single("user", record.receiverId);
    if (rel === "room") return single("room", record.roomId);
  }
  if (model === "review") {
    if (rel === "user") return single("user", record.userId);
    if (rel === "movie") return single("movie", record.movieId);
  }
  if (model === "follow") {
    if (rel === "follower") return single("user", record.followerId);
    if (rel === "following") return single("user", record.followingId);
  }
  if (model === "watchlist") {
    if (rel === "user") return single("user", record.userId);
    if (rel === "items") return many("watchlistItem", "watchlistId", record.id);
  }
  if (model === "watchlistItem") {
    if (rel === "watchlist") return single("watchlist", record.watchlistId);
    if (rel === "movie") return single("movie", record.movieId);
  }
  if (model === "notification") {
    if (rel === "user") return single("user", record.userId);
    if (rel === "actor") return single("user", record.actorId);
  }
  if (model === "user") {
    if (rel === "reviews") return many("review", "userId", record.id);
    if (rel === "watchlists") return many("watchlist", "userId", record.id);
  }
  return undefined;
}

function sortRecords(items: AnyRecord[], orderBy?: AnyRecord | AnyRecord[]): AnyRecord[] {
  if (!orderBy) return items;
  const specs = Array.isArray(orderBy) ? orderBy : [orderBy];
  return [...items].sort((a, b) => {
    for (const spec of specs) {
      for (const [field, dir] of Object.entries(spec)) {
        const av = a[field];
        const bv = b[field];
        if (av === bv) continue;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = av < bv ? -1 : 1;
        return dir === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function buildDefaults(model: keyof MockStore, data: AnyRecord): AnyRecord {
  const now = new Date();
  const base: AnyRecord = {
    id: data.id || cuid(String(model)),
    ...data,
  };
  if (model === "user") {
    base.role ??= "USER";
    base.language ??= "en";
    base.theme ??= "dark";
    base.banned ??= false;
    base.tokenVersion ??= 0;
    base.watchHours ??= 0;
    base.avatar ??= null;
    base.bio ??= null;
    base.createdAt ??= now;
    base.updatedAt ??= now;
  } else if (model === "refreshToken") {
    base.revoked ??= false;
    base.createdAt ??= now;
  } else if (model === "movie") {
    base.source ??= "TMDB";
    base.tmdbId ??= null;
    base.titleFa ??= null;
    base.poster ??= null;
    base.backdrop ??= null;
    base.description ??= null;
    base.year ??= null;
    base.rating ??= null;
    base.genre ??= null;
    base.runtime ??= null;
    base.videoUrl ??= null;
    base.trailerUrl ??= null;
    base.archiveId ??= null;
    base.youtubeId ??= null;
    base.vimeoId ??= null;
    base.createdAt ??= now;
    base.updatedAt ??= now;
  } else if (model === "room") {
    base.isPublic ??= true;
    base.maxUsers ??= 50;
    base.status ??= "WAITING";
    base.currentTime ??= 0;
    base.isPlaying ??= false;
    base.lastSyncAt ??= now;
    base.description ??= null;
    base.movieId ??= null;
    base.createdAt ??= now;
    base.updatedAt ??= now;
  } else if (model === "roomMember") {
    base.role ??= "MEMBER";
    base.joinedAt ??= now;
  } else if (model === "message") {
    base.type ??= "TEXT";
    base.roomId ??= null;
    base.receiverId ??= null;
    base.userId ??= null;
    base.createdAt ??= now;
  } else if (model === "review") {
    base.createdAt ??= now;
    base.updatedAt ??= now;
  } else if (model === "follow") {
    base.createdAt ??= now;
  } else if (model === "watchlist") {
    base.isPublic ??= false;
    base.createdAt ??= now;
    base.updatedAt ??= now;
  } else if (model === "watchlistItem") {
    base.addedAt ??= now;
  } else if (model === "notification") {
    base.isRead ??= false;
    base.actorId ??= null;
    base.link ??= null;
    base.createdAt ??= now;
  }
  return base;
}

function createModelDelegate(storeGetter: () => MockStore, model: keyof MockStore) {
  return {
    async findMany(args: AnyRecord = {}) {
      const store = storeGetter();
      let items = store[model].filter((r) => matchWhere(store, model, r, args.where));
      if (args.orderBy) items = sortRecords(items, args.orderBy);
      if (typeof args.skip === "number") items = items.slice(args.skip);
      if (typeof args.take === "number") items = items.slice(0, args.take);
      return items.map((r) => hydrateRecord(store, model, r, args));
    },
    async findFirst(args: AnyRecord = {}) {
      const store = storeGetter();
      let items = store[model].filter((r) => matchWhere(store, model, r, args.where));
      if (args.orderBy) items = sortRecords(items, args.orderBy);
      const found = items[0];
      return found ? hydrateRecord(store, model, found, args) : null;
    },
    async findUnique(args: AnyRecord = {}) {
      const store = storeGetter();
      const found = store[model].find((r) => matchWhere(store, model, r, args.where));
      return found ? hydrateRecord(store, model, found, args) : null;
    },
    async create(args: AnyRecord) {
      const store = storeGetter();
      const record = buildDefaults(model, args.data || {});
      store[model].push(record);
      return hydrateRecord(store, model, record, args);
    },
    async createMany(args: AnyRecord) {
      const store = storeGetter();
      const list = Array.isArray(args.data) ? args.data : [];
      for (const item of list) {
        store[model].push(buildDefaults(model, item));
      }
      return { count: list.length };
    },
    async update(args: AnyRecord) {
      const store = storeGetter();
      const idx = store[model].findIndex((r) => matchWhere(store, model, r, args.where));
      if (idx === -1) throw new Error(`${String(model)} record not found`);
      const next = { ...store[model][idx], ...args.data, updatedAt: new Date() };
      store[model][idx] = next;
      return hydrateRecord(store, model, next, args);
    },
    async updateMany(args: AnyRecord) {
      const store = storeGetter();
      let count = 0;
      store[model] = store[model].map((r) => {
        if (matchWhere(store, model, r, args.where)) {
          count++;
          return { ...r, ...args.data, updatedAt: new Date() };
        }
        return r;
      });
      return { count };
    },
    async upsert(args: AnyRecord) {
      const store = storeGetter();
      const existing = store[model].find((r) => matchWhere(store, model, r, args.where));
      if (existing) {
        return this.update({ where: args.where, data: args.update, include: args.include, select: args.select });
      }
      return this.create({ data: args.create, include: args.include, select: args.select });
    },
    async delete(args: AnyRecord) {
      const store = storeGetter();
      const idx = store[model].findIndex((r) => matchWhere(store, model, r, args.where));
      if (idx === -1) throw new Error(`${String(model)} record not found`);
      const [removed] = store[model].splice(idx, 1);
      return hydrateRecord(store, model, removed, args);
    },
    async deleteMany(args: AnyRecord = {}) {
      const store = storeGetter();
      const before = store[model].length;
      store[model] = store[model].filter((r) => !matchWhere(store, model, r, args.where));
      return { count: before - store[model].length };
    },
    async count(args: AnyRecord = {}) {
      const store = storeGetter();
      return store[model].filter((r) => matchWhere(store, model, r, args.where)).length;
    },
  };
}

export function createMockPrisma(storeGetter: () => MockStore = getMockStore) {
  return {
    user: createModelDelegate(storeGetter, "user"),
    refreshToken: createModelDelegate(storeGetter, "refreshToken"),
    movie: createModelDelegate(storeGetter, "movie"),
    room: createModelDelegate(storeGetter, "room"),
    roomMember: createModelDelegate(storeGetter, "roomMember"),
    message: createModelDelegate(storeGetter, "message"),
    review: createModelDelegate(storeGetter, "review"),
    follow: createModelDelegate(storeGetter, "follow"),
    watchlist: createModelDelegate(storeGetter, "watchlist"),
    watchlistItem: createModelDelegate(storeGetter, "watchlistItem"),
    notification: createModelDelegate(storeGetter, "notification"),
    $connect: async () => undefined,
    $disconnect: async () => undefined,
  };
}
