DROP TABLE IF EXISTS pastes;

CREATE TABLE pastes (
    id integer PRIMARY KEY,
    public_id text NOT NULL,
    content_type text NOT NULL,
    content text NOT NULL,
    created_at text NOT NULL, -- ISO 8601
    expires_at text -- ISO 8601, NULL if never expires
);

CREATE INDEX IF NOT EXISTS pastes_public_id_idx ON pastes (public_id);