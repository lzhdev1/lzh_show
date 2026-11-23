-- TTFarm 农场游戏 · 数据库结构
-- 库：ttfarm（与主站、RAG、Blog 等项目的库同在 shared-postgres 实例里，各自独立）
--
-- 设计要点：
--   1. users 只放账号身份，farm_states 只放游戏存档，两张表通过 user_id 一对一绑定，
--      删用户连带删存档（ON DELETE CASCADE）。
--   2. 隔离靠主键：farm_states 的主键就是 user_id，服务端只按「登录态解出来的 user_id」
--      读写，接口不接受客户端传入的 user_id，所以一个账号摸不到别人的存档。
--   3. 地块、种子、收成这类每次整体读写的小结构放 JSONB：格子数量固定、字段会随玩法迭代，
--      用 JSONB 不必每加一种作物就改表；金币、等级这种要查询/排序的数值单独成列。
--   4. 登录名标识账号，昵称用于展示和查找好友，好友关系通过用户 ID 留存。

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      VARCHAR(32)  NOT NULL UNIQUE,
  password_hash TEXT,
  nickname      VARCHAR(32)  NOT NULL DEFAULT '',
  avatar_id     VARCHAR(32)  NOT NULL DEFAULT 'xiaosui',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- PostgreSQL and all nickname lookup paths use the same Unicode comparison.
BEGIN;
ALTER TABLE users ALTER COLUMN nickname SET DEFAULT '';
CREATE OR REPLACE FUNCTION farm_nickname_key(value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT NULLIF(lower(btrim(normalize(value, NFKC),
    U&'\0009\000A\000B\000C\000D\0020\0085\1680\2028\2029\FEFF')), '');
$$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname_key text
  GENERATED ALWAYS AS (farm_nickname_key(nickname)) STORED;

-- On first upgrade the earliest account keeps the spelling. Other owners of the
-- same nickname receive an available suffix and keep their farm, friends and session.
DO $$
DECLARE
  duplicate record;
  suffix integer;
  candidate text;
BEGIN
  IF to_regclass('users_nickname_key_uq') IS NULL THEN
    FOR duplicate IN
      SELECT id, nickname FROM (
        SELECT id, nickname, row_number() OVER (PARTITION BY nickname_key ORDER BY id) AS position
        FROM users WHERE nickname_key IS NOT NULL
      ) named WHERE position > 1 ORDER BY id
    LOOP
      suffix := 2;
      LOOP
        candidate := left(btrim(duplicate.nickname), 15 - length(suffix::text)) || '·' || suffix::text;
        EXIT WHEN NOT EXISTS (SELECT 1 FROM users WHERE nickname_key = farm_nickname_key(candidate));
        suffix := suffix + 1;
      END LOOP;
      UPDATE users SET nickname = candidate WHERE id = duplicate.id;
    END LOOP;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS users_nickname_key_uq ON users(nickname_key);
COMMIT;

CREATE TABLE IF NOT EXISTS farm_states (
  user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coins         BIGINT       NOT NULL DEFAULT 0,
  xp            INTEGER      NOT NULL DEFAULT 0,
  plots         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  seeds         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  harvest       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  selected_seed VARCHAR(32)  NOT NULL DEFAULT 'radish',
  backpack_level INTEGER     NOT NULL DEFAULT 1,
  codex_collected JSONB      NOT NULL DEFAULT '{}'::jsonb,
  save_version  INTEGER      NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 同一份脚本也可升级已有农场，旧存档会沿用原木庭院与田间工装。
-- bottom_id 为空时，下装随 outfit_id 的整套服装。
ALTER TABLE farm_states
  ADD COLUMN IF NOT EXISTS outfit_id VARCHAR(32) NOT NULL DEFAULT 'field',
  ADD COLUMN IF NOT EXISTS bottom_id VARCHAR(32),
  ADD COLUMN IF NOT EXISTS decor JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ranch JSONB NOT NULL DEFAULT '{"level":1,"animals":[],"ridingId":null}'::jsonb;

-- 野菜采摘记录：rotation 是刷新轮次，taken 是本轮已采的菜丛编号
ALTER TABLE farm_states ADD COLUMN IF NOT EXISTS forage JSONB NOT NULL DEFAULT '{"rotation":0,"taken":[]}'::jsonb;

-- 车库随账号存档，cars 数组与 activeId 均由服务端归一化后落库
ALTER TABLE farm_states ADD COLUMN IF NOT EXISTS garage JSONB NOT NULL DEFAULT '{"cars":[],"activeId":null}'::jsonb;

-- 背包等级：Lv1 每类 30 格，每升一级 +10，最高 Lv15
ALTER TABLE farm_states ADD COLUMN IF NOT EXISTS backpack_level INTEGER NOT NULL DEFAULT 1;

-- 图鉴收集记录：只增不减，键为 plant:作物 / mutation:变异 / animal:动物
ALTER TABLE farm_states ADD COLUMN IF NOT EXISTS codex_collected JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS farm_states_xp_idx ON farm_states (xp DESC);
CREATE INDEX IF NOT EXISTS farm_states_coins_idx ON farm_states (coins DESC, user_id);

ALTER TABLE farm_states ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS farm_owner_writes (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  write_id UUID NOT NULL,
  revision INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,write_id)
);
CREATE INDEX IF NOT EXISTS farm_owner_writes_age_idx ON farm_owner_writes(user_id,recorded_at);

CREATE TABLE IF NOT EXISTS farm_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  protected BOOLEAN NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS farm_sessions_user_idx ON farm_sessions(user_id);

CREATE TABLE IF NOT EXISTS farm_friendships (
  lo BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hi BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by BIGINT NOT NULL CHECK (requested_by IN (lo,hi)),
  accepted BOOLEAN NOT NULL DEFAULT false,
  lo_grants BOOLEAN NOT NULL DEFAULT false,
  hi_grants BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY(lo,hi),
  CHECK (lo < hi)
);
CREATE INDEX IF NOT EXISTS farm_friendships_hi_idx ON farm_friendships(hi);

-- 每个玩家仅在一个房间。仅最近心跳有效，离开请求丢失时也会自然下线。
CREATE TABLE IF NOT EXISTS farm_presence (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  owner_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pose JSONB NOT NULL,
  seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS farm_presence_room_idx ON farm_presence(owner_id,seen_at DESC);

-- 房间聊天：每位房主一本留言册，只让同一房间的人读写。
-- 保留策略由服务端按房间裁剪（默认最近 200 条），客户端只拉最近 20 条。
CREATE TABLE IF NOT EXISTS farm_chat (
  id         BIGSERIAL PRIMARY KEY,
  owner_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname   VARCHAR(32) NOT NULL,
  body       VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS farm_chat_room_idx ON farm_chat(owner_id,created_at DESC);

-- 房主请离记录：5 分钟内访客无法再次进入该农场，好友关系不受影响。
CREATE TABLE IF NOT EXISTS farm_room_kicks (
  owner_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  until     TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(owner_id,user_id)
);
CREATE INDEX IF NOT EXISTS farm_room_kicks_until_idx ON farm_room_kicks(until);

