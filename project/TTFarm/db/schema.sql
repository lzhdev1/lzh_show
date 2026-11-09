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
--   4. password_hash 预留：当前阶段只用 username 登录，密码列留空不参与校验，
--      以后要开密码登录直接把这一列接上即可，不用改表结构。

CREATE TABLE IF NOT EXISTS users (
  id            BIGSERIAL PRIMARY KEY,
  username      VARCHAR(32)  NOT NULL UNIQUE,
  password_hash TEXT,
  nickname      VARCHAR(32)  NOT NULL DEFAULT '农场主',
  avatar_id     VARCHAR(32)  NOT NULL DEFAULT 'xiaosui',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS farm_states (
  user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  coins         BIGINT       NOT NULL DEFAULT 0,
  xp            INTEGER      NOT NULL DEFAULT 0,
  plots         JSONB        NOT NULL DEFAULT '[]'::jsonb,
  seeds         JSONB        NOT NULL DEFAULT '{}'::jsonb,
  harvest       JSONB        NOT NULL DEFAULT '{}'::jsonb,
  selected_seed VARCHAR(32)  NOT NULL DEFAULT 'radish',
  save_version  INTEGER      NOT NULL DEFAULT 1,
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 常用查询：按等级排行的潜力（现在没用上，先把索引留好，避免以后加索引要锁表）
CREATE INDEX IF NOT EXISTS farm_states_xp_idx ON farm_states (xp DESC);
